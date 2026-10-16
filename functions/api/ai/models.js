/**
 * GET /api/ai/models
 * Model discovery with dynamic live prefetching from Google Generative Language API
 * Requires Admin authentication
 */
import { validateRequest } from '../../_lib/auth.js';
import { getCorsHeaders } from '../../_lib/cors.js';

let cachedModels = null;
let cacheTime = 0;
const CACHE_TTL = 300 * 1000; // 5 minutes TTL for live responsiveness

const FALLBACK_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Recommandé)', description: 'Ultra-rapide, optimisé pour l’analyse d’assiduité et la rédaction' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Raisonnement avancé, idéal pour les rapports complexes et la détection d’anomalies' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Haute cadence et faible latence' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Modèle stable et léger' },
];

const PRIORITY_ORDER = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-flash-latest',
  'gemini-pro-latest',
  'gemini-2.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.1-pro-preview',
];

export async function onRequestGet(context) {
  const cors = getCorsHeaders(context.request);
  const db = context.env.DB;
  const url = new URL(context.request.url);
  const forceFresh = url.searchParams.get('fresh') === 'true' || url.searchParams.get('refresh') === 'true';

  const auth = await validateRequest(context.request, db);
  if (!auth.authenticated) {
    return new Response(JSON.stringify({ success: false, error: auth.error }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  try {
    // 1. Resolve API Key: header -> query param -> D1 school_settings -> env
    let apiKey = context.request.headers.get('x-gemini-key') || url.searchParams.get('apiKey') || context.env.GEMINI_API_KEY;
    let defaultModel = 'gemini-2.5-flash';

    if (!apiKey && db) {
      try {
        const row = await db.prepare(
          "SELECT data FROM school_settings WHERE key = 'ai_config' LIMIT 1"
        ).first();
        if (row && row.data) {
          const cfg = JSON.parse(row.data);
          if (cfg.apiKey) apiKey = cfg.apiKey;
          if (cfg.defaultModel) defaultModel = cfg.defaultModel;
        }
      } catch (e) {
        console.warn('[ai/models] D1 config lookup failed:', e.message);
      }
    }

    if (!apiKey) {
      return new Response(JSON.stringify({
        success: true,
        hasApiKey: false,
        models: FALLBACK_MODELS,
        defaultModel,
        warning: 'Clé API Gemini non configurée. Veuillez ajouter votre clé dans les Paramètres IA.',
      }), {
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // 2. Check cache unless fresh retrieval requested
    const now = Date.now();
    if (!forceFresh && cachedModels && (now - cacheTime < CACHE_TTL)) {
      return new Response(JSON.stringify({
        success: true,
        hasApiKey: true,
        models: cachedModels,
        defaultModel,
        cached: true,
        isLive: true,
        count: cachedModels.length,
      }), {
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // 3. Live Query to Google Generative Language API
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!res.ok) {
      const errText = await res.text();
      console.warn('[ai/models] Google API error:', res.status, errText);
      return new Response(JSON.stringify({
        success: true,
        hasApiKey: true,
        models: cachedModels || FALLBACK_MODELS,
        defaultModel,
        fallback: true,
      }), {
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const data = await res.json();
    const rawList = Array.isArray(data.models) ? data.models : [];

    // Filter to generative chat/text models
    const geminiModels = rawList
      .filter(m => m.name && (m.name.includes('gemini') || m.supportedGenerationMethods?.includes('generateContent')))
      .map(m => {
        const cleanId = m.name.replace(/^models\//, '');
        return {
          id: cleanId,
          name: m.displayName || cleanId,
          description: m.description || '',
          inputTokenLimit: m.inputTokenLimit,
          outputTokenLimit: m.outputTokenLimit,
        };
      });

    // Sort models with flagship priority models first
    geminiModels.sort((a, b) => {
      const idxA = PRIORITY_ORDER.indexOf(a.id);
      const idxB = PRIORITY_ORDER.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

    const finalModels = geminiModels.length > 0 ? geminiModels : FALLBACK_MODELS;
    cachedModels = finalModels;
    cacheTime = now;

    return new Response(JSON.stringify({
      success: true,
      hasApiKey: true,
      models: finalModels,
      defaultModel,
      isLive: true,
      count: finalModels.length,
      refreshedAt: new Date(now).toISOString(),
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=300',
        ...cors
      },
    });
  } catch (error) {
    console.error('[ai/models] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erreur lors de la récupération des modèles',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
}
