/**
 * /api/ai/config
 * GET: Get masked Gemini config
 * POST: Update Gemini API Key and default model (stored in school_settings)
 * Requires Admin authentication
 */
import { validateRequest } from '../../_lib/auth.js';
import { getCorsHeaders } from '../../_lib/cors.js';

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
    let apiKey = context.env.GEMINI_API_KEY || '';
    let defaultModel = 'gemini-2.5-flash';
    let isFromEnv = Boolean(context.env.GEMINI_API_KEY);

    if (db) {
      const row = await db.prepare(
        "SELECT data FROM school_settings WHERE key = 'ai_config' LIMIT 1"
      ).first();
      if (row && row.data) {
        try {
          const cfg = JSON.parse(row.data);
          if (cfg.apiKey) {
            apiKey = cfg.apiKey;
            isFromEnv = false;
          }
          if (cfg.defaultModel) defaultModel = cfg.defaultModel;
        } catch {}
      }
    }

    const hasKey = Boolean(apiKey);
    const maskedKey = hasKey
      ? (apiKey.length > 8 ? `${apiKey.substring(0, 4)}••••••••${apiKey.substring(apiKey.length - 4)}` : '••••••••')
      : '';

    return new Response(JSON.stringify({
      success: true,
      hasKey,
      maskedKey,
      isFromEnv,
      defaultModel,
    }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
}

export async function onRequestPost(context) {
  const cors = getCorsHeaders(context.request);
  const db = context.env.DB;

  const auth = await validateRequest(context.request, db);
  if (!auth.authenticated) {
    return new Response(JSON.stringify({ success: false, error: auth.error }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  // Only admin or super_admin can configure AI key
  if (auth.user?.role !== 'admin' && auth.user?.role !== 'super_admin') {
    return new Response(JSON.stringify({ success: false, error: 'Permission refusée' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  try {
    const body = await context.request.json();
    const { apiKey, defaultModel = 'gemini-2.5-flash' } = body;

    const tenantId = auth.user?.tenantId || 'default';

    // Retrieve existing config
    let existingCfg = {};
    const row = await db.prepare(
      "SELECT data FROM school_settings WHERE tenant_id = ? AND key = 'ai_config' LIMIT 1"
    ).bind(tenantId).first();
    if (row && row.data) {
      try { existingCfg = JSON.parse(row.data); } catch {}
    }

    const newCfg = {
      ...existingCfg,
      defaultModel,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.user?.username || 'admin',
    };

    // Only update apiKey if a non-empty string is provided (and not the masked string)
    if (apiKey && typeof apiKey === 'string' && !apiKey.includes('••••')) {
      newCfg.apiKey = apiKey.trim();
    }

    await db.prepare(
      `INSERT INTO school_settings (id, tenant_id, key, data, updated_at)
       VALUES ('ai_config', ?, 'ai_config', ?, datetime('now'))
       ON CONFLICT(tenant_id, key) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`
    ).bind(tenantId, JSON.stringify(newCfg)).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Configuration IA enregistrée avec succès',
      defaultModel: newCfg.defaultModel,
      hasKey: Boolean(newCfg.apiKey || context.env.GEMINI_API_KEY),
    }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
}
