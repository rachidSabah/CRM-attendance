/**
 * POST /api/ai/test
 * Test Gemini API connection and latency
 * Requires Admin authentication
 */
import { validateRequest } from '../../_lib/auth.js';
import { getCorsHeaders } from '../../_lib/cors.js';

export async function onRequestPost(context) {
  const cors = getCorsHeaders(context.request);
  const db = context.env.DB;

  try {
    let body = {};
    try {
      body = await context.request.json();
    } catch {}

    const directKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';

    // If no direct API key is supplied in the request body, validate admin session
    if (!directKey) {
      const auth = await validateRequest(context.request, db);
      if (!auth.authenticated) {
        return new Response(JSON.stringify({ success: false, error: auth.error || 'Authentification requise pour tester la clé système' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...cors },
        });
      }
    }

    // Resolve API Key
    let apiKey = body.apiKey || context.env.GEMINI_API_KEY;
    let selectedModel = body.model || 'gemini-2.5-flash';

    if (!apiKey && db) {
      try {
        const row = await db.prepare(
          "SELECT data FROM school_settings WHERE key = 'ai_config' LIMIT 1"
        ).first();
        if (row && row.data) {
          const cfg = JSON.parse(row.data);
          if (cfg.apiKey) apiKey = cfg.apiKey;
          if (!body.model && cfg.defaultModel) selectedModel = cfg.defaultModel;
        }
      } catch (e) {
        console.warn('[ai/test] D1 config lookup failed:', e.message);
      }
    }

    if (!apiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Aucune clé API Gemini fournie ou configurée.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const startTime = Date.now();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

    const payload = {
      contents: [
        {
          parts: [{ text: 'Ping de test: Réponds exactement "INFOHAS AI Connecté avec succès" en une seule ligne.' }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 60,
      },
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({
        success: false,
        latencyMs,
        model: selectedModel,
        status: res.status,
        error: `Erreur API Gemini (${res.status}): ${errText}`,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const data = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Connexion établie avec succès';

    return new Response(JSON.stringify({
      success: true,
      latencyMs,
      model: selectedModel,
      message: reply,
      timestamp: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  } catch (error) {
    console.error('[ai/test] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erreur lors du test de connexion',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
}
