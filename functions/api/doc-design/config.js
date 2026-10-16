/**
 * /api/doc-design/config
 * GET: Retrieve document customization presets and active settings
 * POST: Save or update document customization presets
 * Persisted in D1 table `school_settings` under key `doc_design_settings`
 */
import { validateRequest } from '../../_lib/auth.js';
import { getCorsHeaders } from '../../_lib/cors.js';

const ALLOWED_FONTS = [
  'Times New Roman',
  'Arial',
  'Calibri',
  'Georgia',
  'Garamond',
  'Montserrat'
];

function isValidHexColor(hex) {
  if (!hex || typeof hex !== 'string') return false;
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex.trim());
}

export async function onRequestGet(context) {
  const cors = getCorsHeaders(context.request);
  const db = context.env.DB;

  try {
    let settings = null;
    if (db) {
      try {
        const row = await db.prepare(
          "SELECT data FROM school_settings WHERE key = 'doc_design_settings' LIMIT 1"
        ).first();
        if (row && row.data) {
          try {
            settings = JSON.parse(row.data);
          } catch {}
        }
      } catch (dbErr) {
        console.warn('[doc-design/config] D1 query failed, fallback to null (client will use defaults):', dbErr.message);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      settings,
    }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: true, settings: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
}

export async function onRequestPost(context) {
  const cors = getCorsHeaders(context.request);
  const db = context.env.DB;

  let body = {};
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Corps JSON invalide' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  // Authorization check
  const auth = await validateRequest(context.request, db);
  if (auth.authenticated && auth.user?.role !== 'admin' && auth.user?.role !== 'super_admin') {
    return new Response(JSON.stringify({ success: false, error: 'Accès réservé aux administrateurs' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  try {
    const { presets, activePresetIdByDocType } = body;

    if (!Array.isArray(presets)) {
      return new Response(JSON.stringify({ success: false, error: 'Liste des préréglages invalide' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // Validate each preset
    for (const p of presets) {
      if (!p.id || !p.name || !p.documentType) {
        return new Response(JSON.stringify({ success: false, error: 'Champs obligatoires manquants dans un préréglage' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...cors },
        });
      }

      // Validate heading colors and font
      if (p.heading) {
        if (p.heading.textColor && !isValidHexColor(p.heading.textColor)) {
          return new Response(JSON.stringify({ success: false, error: `Couleur hexadécimale d'en-tête invalide: ${p.heading.textColor}` }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...cors },
          });
        }
        if (p.heading.borderColor && !isValidHexColor(p.heading.borderColor)) {
          return new Response(JSON.stringify({ success: false, error: `Couleur de bordure d'en-tête invalide: ${p.heading.borderColor}` }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...cors },
          });
        }
        if (p.heading.fontFamily && !ALLOWED_FONTS.includes(p.heading.fontFamily)) {
          p.heading.fontFamily = 'Times New Roman';
        }
      }

      // Validate footer colors
      if (p.footer) {
        if (p.footer.textColor && !isValidHexColor(p.footer.textColor)) {
          return new Response(JSON.stringify({ success: false, error: `Couleur hexadécimale de pied de page invalide: ${p.footer.textColor}` }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...cors },
          });
        }
        if (p.footer.separatorColor && !isValidHexColor(p.footer.separatorColor)) {
          return new Response(JSON.stringify({ success: false, error: `Couleur de séparateur de pied de page invalide: ${p.footer.separatorColor}` }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...cors },
          });
        }
      }
    }

    const payload = {
      presets,
      activePresetIdByDocType: activePresetIdByDocType || {},
      updatedAt: new Date().toISOString(),
      updatedBy: auth.user?.username || 'admin',
    };

    const tenantId = auth.user?.tenantId || 'default';

    await db.prepare(
      `INSERT INTO school_settings (id, tenant_id, key, data, updated_at)
       VALUES ('doc_design_settings', ?, 'doc_design_settings', ?, datetime('now'))
       ON CONFLICT(tenant_id, key) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`
    ).bind(tenantId, JSON.stringify(payload)).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Paramètres de personnalisation des documents enregistrés avec succès',
      settings: payload,
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
