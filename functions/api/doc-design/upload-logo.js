/**
 * /api/doc-design/upload-logo
 * POST: Upload and validate custom logo for document exports
 * Enforces magic bytes verification, MIME checking, and size limits (max 2MB)
 */
import { validateRequest } from '../../_lib/auth.js';
import { getCorsHeaders } from '../../_lib/cors.js';

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

function isPng(bytes) {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function isJpeg(bytes) {
  return (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  );
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

export async function onRequestPost(context) {
  const cors = getCorsHeaders(context.request);
  const db = context.env.DB;

  const auth = await validateRequest(context.request, db);
  if (auth.authenticated && auth.user?.role !== 'admin' && auth.user?.role !== 'super_admin') {
    return new Response(JSON.stringify({ success: false, error: 'Accès réservé aux administrateurs' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  try {
    let base64Content = '';
    let mimeType = '';
    let filename = 'logo.png';

    const contentType = context.request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await context.request.json();
      base64Content = body.base64 || '';
      filename = sanitizeFilename(body.filename || 'logo.png');
      mimeType = body.mimeType || '';

      if (base64Content.includes(',')) {
        const parts = base64Content.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        if (mimeMatch) mimeType = mimeMatch[1];
        base64Content = parts[1];
      }
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await context.request.formData();
      const file = formData.get('file');
      if (!file || typeof file === 'string') {
        return new Response(JSON.stringify({ success: false, error: 'Aucun fichier transmis' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...cors },
        });
      }
      filename = sanitizeFilename(file.name || 'logo.png');
      mimeType = file.type;
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      base64Content = btoa(binary);
    } else {
      return new Response(JSON.stringify({ success: false, error: 'Type de contenu non supporté' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    if (!base64Content) {
      return new Response(JSON.stringify({ success: false, error: 'Données d’image vides' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // Decode and validate raw bytes
    const binary = atob(base64Content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    if (bytes.length > MAX_LOGO_SIZE_BYTES) {
      return new Response(JSON.stringify({
        success: false,
        error: `Fichier trop volumineux (${(bytes.length / (1024 * 1024)).toFixed(2)} Mo). La taille maximale autorisée est de 2 Mo.`,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // Magic bytes security verification
    let verifiedMime = '';
    if (isPng(bytes)) {
      verifiedMime = 'image/png';
    } else if (isJpeg(bytes)) {
      verifiedMime = 'image/jpeg';
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'Format d’image non supporté ou fichier corrompu. Veuillez utiliser une image PNG ou JPEG valide.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const dataUrl = `data:${verifiedMime};base64,${base64Content}`;
    const tenantId = auth.user?.tenantId || 'default';

    const logoRecord = {
      filename,
      mimeType: verifiedMime,
      size: bytes.length,
      dataUrl,
      uploadedAt: new Date().toISOString(),
      uploadedBy: auth.user?.username || 'admin',
    };

    if (db) {
      await db.prepare(
        `INSERT INTO school_settings (id, tenant_id, key, data, updated_at)
         VALUES ('doc_design_custom_logo', ?, 'doc_design_custom_logo', ?, datetime('now'))
         ON CONFLICT(tenant_id, key) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`
      ).bind(tenantId, JSON.stringify(logoRecord)).run();
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Logo institutionnel téléversé et vérifié avec succès',
      logoUrl: dataUrl,
      filename,
      size: bytes.length,
      mimeType: verifiedMime,
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
