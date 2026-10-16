const PROD_URL = 'https://crm-attendance.pages.dev';

async function verifyLiveProduction() {
  console.log('================================================================');
  console.log(`🌐 LIVE PRODUCTION VERIFICATION ON: ${PROD_URL}`);
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Static site serving
  console.log('1. Checking static frontend delivery:');
  const siteRes = await fetch(PROD_URL);
  assert(siteRes.status === 200, `Homepage serves HTTP 200 (got ${siteRes.status})`);
  const html = await siteRes.text();
  assert(html.includes('INFOHAS') || html.includes('Attendance') || html.includes('CRM'), 'Homepage contains INFOHAS brand');

  // 2. Admin login with master credentials
  console.log('\n2. Testing Admin Login with "admin" and "Santafee@@@@@1972":');
  const loginRes = await fetch(`${PROD_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Santafee@@@@@1972' }),
  });
  assert(loginRes.status === 200, `Login returns HTTP 200 (got ${loginRes.status})`);
  const loginData = await loginRes.json();
  assert(loginData.success === true, 'Login response success: true');
  assert(loginData.user?.username === 'admin', 'Username is admin');
  assert(loginData.user?.role === 'super_admin', 'Role is super_admin');
  assert(loginData.user?.is_super_admin === true, 'is_super_admin is true');
  assert(typeof loginData.token === 'string' && loginData.token.startsWith('d1_s.'), 'Generated token is signed token (d1_s...)');

  const token = loginData.token;

  // 3. Admin login with bad password
  console.log('\n3. Testing Admin Login with incorrect password:');
  const badLoginRes = await fetch(`${PROD_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'InvalidPassword999!' }),
  });
  assert(badLoginRes.status === 401, `Bad password returns HTTP 401 (got ${badLoginRes.status})`);
  const badData = await badLoginRes.json();
  assert(badData.success === false, 'Bad password response success: false');

  // 4. Session keepalive /api/auth/me
  console.log('\n4. Testing /api/auth/me session keepalive:');
  const meRes = await fetch(`${PROD_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(meRes.status === 200, `/api/auth/me returns HTTP 200 (got ${meRes.status})`);
  const meData = await meRes.json();
  assert(meData.success === true && meData.user?.username === 'admin', 'Profile returns username admin');

  // 5. Cloud Sync Status /api/sync/status
  console.log('\n5. Testing /api/sync/status cloud status:');
  const statusRes = await fetch(`${PROD_URL}/api/sync/status?tenant_id=default`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(statusRes.status === 200, `/api/sync/status returns HTTP 200 (got ${statusRes.status})`);
  const statusData = await statusRes.json();
  assert(statusData.success === true, 'Sync status success: true');
  assert(statusData.connected === true, 'Sync status connected: true');
  assert(statusData.entity_counts?.students === 63, `Students count is 63 (got ${statusData.entity_counts?.students})`);
  assert(statusData.entity_counts?.classes === 3, `Classes count is 3 (got ${statusData.entity_counts?.classes})`);
  assert(statusData.entity_counts?.modules === 22, `Modules count is 22 (got ${statusData.entity_counts?.modules})`);

  // 6. Data Recovery /api/sync/pull
  console.log('\n6. Testing /api/sync/pull data recovery:');
  const pullRes = await fetch(`${PROD_URL}/api/sync/pull?tenant_id=default`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(pullRes.status === 200, `/api/sync/pull returns HTTP 200 (got ${pullRes.status})`);
  const pullData = await pullRes.json();
  assert(pullData.success === true, 'Pull success: true');
  assert(Array.isArray(pullData.data?.students) && pullData.data.students.length === 63, `All 63 students recovered (got ${pullData.data?.students?.length})`);
  assert(Array.isArray(pullData.data?.classes) && pullData.data.classes.length === 3, `All 3 classes recovered (got ${pullData.data?.classes?.length})`);
  assert(Array.isArray(pullData.data?.modules) && pullData.data.modules.length === 22, `All 22 modules recovered (got ${pullData.data?.modules?.length})`);
  assert(pullData.data?.schoolInfo?.name === 'INFOHAS SUP', `School info name is INFOHAS SUP (got ${pullData.data?.schoolInfo?.name})`);

  const firstStudent = pullData.data?.students?.[0];
  console.log(`   -> Sample student recovered: [${firstStudent?.studentId}] ${firstStudent?.fullName} - ${firstStudent?.className}`);

  // 7. Doc Design config /api/doc-design/config
  console.log('\n7. Testing /api/doc-design/config:');
  const docRes = await fetch(`${PROD_URL}/api/doc-design/config`);
  assert(docRes.status === 200, `/api/doc-design/config returns HTTP 200 (got ${docRes.status})`);
  const docData = await docRes.json();
  assert(docData.success === true, 'Doc design config returns success: true');

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

verifyLiveProduction().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
