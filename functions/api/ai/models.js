/**
 * GET /api/ai/models
 * Model discovery with server-side caching
 * Requires Admin authentication
 */
import { validateRequest } from '../../_lib/auth.js';
import { getCorsHeaders } from '../../_lib/cors.js';

let cachedModels = null;
let cacheTime = 0;
const CACHE_TTL = 3600 * 1000; // 1 hour

const FALLBACK_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Recommandé)', description: 'Ultra-rapide, optimisé pour l’analyse d’assiduité et la rédaction' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Raisonnement avancé, idéal pour les rapports complexes et la détection d’anomalies' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Haute cadence et faible latence' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Modèle stable et léger' },
];

export async function onRequestGet(context) {
  const cors = getCorsHeaders(context.request);
  const db = context.env.DB;

  const auth = await validateRequest(context.request, db);
  if (!auth.authenticated) {
    return new Response(JSON.stringify({ success: false, error: auth.error }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  try {
    // 1. Resolve API Key from env or D1 school_settings
    let apiKey = context.env.GEMINI_API_KEY;
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

    // 2. Check cache
    const now = Date.now();
    if (cachedModels && (now - cacheTime < CACHE_TTL)) {
      return new Response(JSON.stringify({
        success: true,
        hasApiKey: true,
        models: cachedModels,
        defaultModel,
        cached: true,
      }), {
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // 3. Query Google Generative Language API
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!res.ok) {
      const errText = await res.text();
      console.warn('[ai/models] Google API error:', res.status, errText);
      return new Response(JSON.stringify({
        success: true,
        hasApiKey: true,
        models: FALLBACK_MODELS,
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

    const finalModels = geminiModels.length > 0 ? geminiModels : FALLBACK_MODELS;
    cachedModels = finalModels;
    cacheTime = now;

    return new Response(JSON.stringify({
      success: true,
      hasApiKey: true,
      models: finalModels,
      defaultModel,
    }), {
      headers: { 'Content-Type': 'application/json', ...cors },
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
