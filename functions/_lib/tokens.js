/**
 * Cryptographic Token Engine for Cloudflare Pages Functions & Workers
 * Generates and verifies HMAC-SHA256 signed session tokens.
 *
 * Guarantees zero-D1-read authentication during D1 rate-limiting or downtime.
 */

const AUTH_SECRET = 'INFOHAS_SECURE_AUTH_SECRET_2026_D1_KEY_V1';

async function getHmacKey(secret = AUTH_SECRET) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function base64UrlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes.buffer;
}

/**
 * Generate signed token
 * payload: { u: username, r: role, t: tenantId, s: is_super_admin, fn: fullName, em: email }
 */
export async function createSignedToken(payload, customSecret) {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + (60 * 24 * 3600), // 60 days validity
  };
  const payloadStr = JSON.stringify(fullPayload);
  const encPayload = base64UrlEncode(payloadStr);

  const key = await getHmacKey(customSecret || AUTH_SECRET);
  const enc = new TextEncoder();
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(encPayload));
  const sigHex = bufToHex(sigBuf);

  return `d1_s.${encPayload}.${sigHex}`;
}

/**
 * Verify signed token
 * Returns { valid: boolean, user?: object, error?: string }
 */
export async function verifySignedToken(token, customSecret) {
  if (!token || typeof token !== 'string' || !token.startsWith('d1_s.')) {
    return { valid: false, error: 'Not a signed token' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed token structure' };
  }

  const [, encPayload, sigHex] = parts;
  try {
    const key = await getHmacKey(customSecret || AUTH_SECRET);
    const enc = new TextEncoder();
    const sigBuf = hexToBuf(sigHex);
    const verified = await crypto.subtle.verify('HMAC', key, sigBuf, enc.encode(encPayload));
    if (!verified) {
      return { valid: false, error: 'Invalid token signature' };
    }

    const payloadJson = base64UrlDecode(encPayload);
    const payload = JSON.parse(payloadJson);
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'Token expired' };
    }

    return {
      valid: true,
      user: {
        id: payload.u || 'admin',
        username: payload.u || 'admin',
        fullName: payload.fn || payload.u || 'Administrateur',
        email: payload.em || '',
        role: payload.r || 'admin',
        tenantId: payload.t || 'default',
        is_super_admin: Boolean(payload.s),
      },
    };
  } catch (err) {
    return { valid: false, error: err.message || 'Token verification error' };
  }
}
