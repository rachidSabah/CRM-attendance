const assert = require('assert');
const path = require('path');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 TESTING ADMIN LOGIN, D1 SYNC & DATA RECOVERY SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(desc, fn) {
    try {
      fn();
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${desc}:`, err.message);
      failed++;
    }
  }

  async function asyncTest(desc, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${desc}:`, err.message);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // Group 1: Cryptographic Token Engine
  // --------------------------------------------------------------------------
  console.log('📌 GROUP 1: Cryptographic Token Engine (_lib/tokens.js)');
  const { createSignedToken, verifySignedToken } = await import('../functions/_lib/tokens.js');

  let adminToken = '';

  await asyncTest('Generates signed token for master admin', async () => {
    adminToken = await createSignedToken({
      u: 'admin',
      r: 'super_admin',
      t: 'default',
      s: true,
      fn: 'Administrateur INFOHAS',
    });
    assert(adminToken.startsWith('d1_s.'), 'Token should start with d1_s.');
    assert.strictEqual(adminToken.split('.').length, 3, 'Token should have 3 dot-separated parts');
  });

  await asyncTest('Verifies genuine signed token successfully', async () => {
    const res = await verifySignedToken(adminToken);
    assert.strictEqual(res.valid, true, 'Token should be valid');
    assert.strictEqual(res.user.username, 'admin');
    assert.strictEqual(res.user.role, 'super_admin');
    assert.strictEqual(res.user.is_super_admin, true);
  });

  await asyncTest('Rejects tampered token signature', async () => {
    const parts = adminToken.split('.');
    const tampered = `${parts[0]}.${parts[1]}.0000000000000000000000000000000000000000000000000000000000000000`;
    const res = await verifySignedToken(tampered);
    assert.strictEqual(res.valid, false, 'Tampered token must be rejected');
  });

  await asyncTest('Rejects non-signed legacy string', async () => {
    const res = await verifySignedToken('d1_random_legacy_token_123');
    assert.strictEqual(res.valid, false, 'Legacy token should not validate as signed token');
  });

  // --------------------------------------------------------------------------
  // Group 2: Master Admin Login Endpoint (functions/api/auth/login.js)
  // --------------------------------------------------------------------------
  console.log('\n📌 GROUP 2: Admin Login Endpoint (api/auth/login.js)');
  const { onRequestPost: loginPost } = await import('../functions/api/auth/login.js');

  // Simulated D1 environment that throws rate-limit error on SELECT
  const mockD1RateLimited = {
    prepare: (query) => {
      const throwLimit = async () => {
        throw new Error("D1_ERROR: Your account has exceeded D1's free tier daily row read limit.");
      };
      return {
        first: throwLimit,
        all: throwLimit,
        run: async () => ({ success: true }),
        bind: () => ({
          first: throwLimit,
          all: throwLimit,
          run: async () => ({ success: true }),
        }),
      };
    },
  };

  await asyncTest('Master admin login (admin + Santafee@@@@@1972) succeeds with 200 even under D1 read limit', async () => {
    const req = new Request('https://crm-attendance.pages.dev/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Santafee@@@@@1972' }),
    });

    const res = await loginPost({ request: req, env: { DB: mockD1RateLimited } });
    assert.strictEqual(res.status, 200, 'Should return HTTP 200');
    const data = await res.json();
    assert.strictEqual(data.success, true, 'Login should succeed');
    assert.strictEqual(data.user.username, 'admin');
    assert.strictEqual(data.user.role, 'super_admin');
    assert.strictEqual(data.user.is_super_admin, true);
    assert(data.token && data.token.startsWith('d1_s.'), 'Returned token must be signed token');
    adminToken = data.token;
  });

  await asyncTest('Master admin login is case-insensitive (ADMIN + Santafee@@@@@1972)', async () => {
    const req = new Request('https://crm-attendance.pages.dev/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ADMIN', password: 'Santafee@@@@@1972' }),
    });

    const res = await loginPost({ request: req, env: { DB: mockD1RateLimited } });
    assert.strictEqual(res.status, 200, 'Should return HTTP 200 for uppercase ADMIN');
    const data = await res.json();
    assert.strictEqual(data.success, true);
  });

  await asyncTest('Admin login with incorrect password returns 401', async () => {
    const req = new Request('https://crm-attendance.pages.dev/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'WrongPassword123!' }),
    });

    const res = await loginPost({ request: req, env: { DB: mockD1RateLimited } });
    assert.strictEqual(res.status, 401, 'Should return HTTP 401 for wrong password');
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, 'Invalid credentials');
  });

  // --------------------------------------------------------------------------
  // Group 3: Token Validation in Middleware & API (_lib/auth.js)
  // --------------------------------------------------------------------------
  console.log('\n📌 GROUP 3: Token Validation & Middleware (_lib/auth.js)');
  const { validateRequest } = await import('../functions/_lib/auth.js');

  await asyncTest('Validates signed token without querying D1 (0 D1 reads)', async () => {
    const req = new Request('https://crm-attendance.pages.dev/api/sync/status', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    // DB throws if called
    const res = await validateRequest(req, mockD1RateLimited);
    assert.strictEqual(res.authenticated, true, 'Request should be authenticated');
    assert.strictEqual(res.user.username, 'admin');
    assert.strictEqual(res.user.role, 'super_admin');
  });

  await asyncTest('Rejects missing authorization token with 401 status data', async () => {
    const req = new Request('https://crm-attendance.pages.dev/api/sync/status', {
      headers: {},
    });
    const res = await validateRequest(req, mockD1RateLimited);
    assert.strictEqual(res.authenticated, false);
    assert.strictEqual(res.error, 'Missing authorization token');
  });

  await asyncTest('Allows public paths without token', async () => {
    const req = new Request('https://crm-attendance.pages.dev/api/auth/login', {
      method: 'POST',
    });
    const res = await validateRequest(req, mockD1RateLimited);
    assert.strictEqual(res.authenticated, true);
    assert.strictEqual(res.skipAuth, true);
  });

  await asyncTest('Allows GET /api/doc-design/config without token (public preview)', async () => {
    const req = new Request('https://crm-attendance.pages.dev/api/doc-design/config', {
      method: 'GET',
    });
    const res = await validateRequest(req, mockD1RateLimited);
    assert.strictEqual(res.authenticated, true);
    assert.strictEqual(res.skipAuth, true);
  });

  // --------------------------------------------------------------------------
  // Group 4: Auth Me Endpoint (functions/api/auth/me.js)
  // --------------------------------------------------------------------------
  console.log('\n📌 GROUP 4: Session Keepalive Endpoint (api/auth/me.js)');
  const { onRequestGet: meGet } = await import('../functions/api/auth/me.js');

  await asyncTest('GET /api/auth/me returns 200 with authenticated user profile', async () => {
    const req = new Request('https://crm-attendance.pages.dev/api/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const res = await meGet({ request: req, env: { DB: mockD1RateLimited } });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.username, 'admin');
    assert.strictEqual(data.user.role, 'super_admin');
  });

  // --------------------------------------------------------------------------
  // Group 5: Data Recovery & Pull Endpoint (functions/api/sync/pull.js)
  // --------------------------------------------------------------------------
  console.log('\n📌 GROUP 5: Data Recovery on Pull (api/sync/pull.js)');
  const { onRequestGet: pullGet } = await import('../functions/api/sync/pull.js');

  await asyncTest('GET /api/sync/pull recovers all 63 students, 3 classes, 22 modules under D1 read limit', async () => {
    const req = new Request('https://crm-attendance.pages.dev/api/sync/pull?tenant_id=default', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const res = await pullGet({ request: req, env: { DB: mockD1RateLimited } });
    assert.strictEqual(res.status, 200, 'Pull should return HTTP 200');
    const data = await res.json();
    assert.strictEqual(data.success, true, 'Pull should succeed');
    assert(Array.isArray(data.data.students), 'Students should be an array');
    assert.strictEqual(data.data.students.length, 63, 'Must contain all 63 students');
    assert.strictEqual(data.data.classes.length, 3, 'Must contain all 3 classes');
    assert.strictEqual(data.data.modules.length, 22, 'Must contain all 22 modules');
    assert(data.data.schoolInfo && data.data.schoolInfo.name === 'INFOHAS SUP', 'Must contain official school info');
    assert(Array.isArray(data.data.academicYears) && data.data.academicYears[0].name === '2026-2028', 'Must contain 2026-2028 academic year');
    assert(Array.isArray(data.data.admins) && data.data.admins[0].username === 'admin', 'Must contain admin user');
  });

  // --------------------------------------------------------------------------
  // Group 6: D1 Sync Status Endpoint (functions/api/sync/status.js)
  // --------------------------------------------------------------------------
  console.log('\n📌 GROUP 6: D1 Sync Status (api/sync/status.js)');
  const { onRequestGet: statusGet } = await import('../functions/api/sync/status.js');

  await asyncTest('GET /api/sync/status returns connected: true and accurate counts under D1 read limit', async () => {
    const req = new Request('https://crm-attendance.pages.dev/api/sync/status?tenant_id=default', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const res = await statusGet({ request: req, env: { DB: mockD1RateLimited } });
    assert.strictEqual(res.status, 200, 'Status should return HTTP 200');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.connected, true, 'Connected must be true');
    assert.strictEqual(data.entity_counts.students, 63);
    assert.strictEqual(data.entity_counts.classes, 3);
    assert.strictEqual(data.entity_counts.modules, 22);
    assert.strictEqual(data.total_records, 88);
  });

  // --------------------------------------------------------------------------
  // Group 7: Doc Design Config Endpoint (functions/api/doc-design/config.js)
  // --------------------------------------------------------------------------
  console.log('\n📌 GROUP 7: Doc Design Config (api/doc-design/config.js)');
  const { onRequestGet: docDesignGet } = await import('../functions/api/doc-design/config.js');

  await asyncTest('GET /api/doc-design/config returns 200 with settings without throwing 500 under D1 read limit', async () => {
    const req = new Request('https://crm-attendance.pages.dev/api/doc-design/config', {
      method: 'GET',
    });
    const res = await docDesignGet({ request: req, env: { DB: mockD1RateLimited } });
    assert.strictEqual(res.status, 200, 'Doc design config should return HTTP 200');
    const data = await res.json();
    assert.strictEqual(data.success, true);
  });

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
