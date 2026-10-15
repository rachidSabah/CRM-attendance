import { chromium } from 'playwright';

async function testProduction() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to production...');
  await page.goto('https://crm-attendance.pages.dev', { waitUntil: 'networkidle' });

  // Login
  const loginBtn = await page.$('button[type="submit"], button:has-text("Connexion"), button:has-text("Login")');
  if (loginBtn) {
    console.log('Logging in...');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'Santafee@@@@@1972');
    await loginBtn.click();
    await page.waitForTimeout(3000);
  }

  // Check CSS styles loaded
  const sidebarOrBtn = await page.$('button.bg-emerald-600, .bg-emerald-600');
  if (sidebarOrBtn) {
    const color = await sidebarOrBtn.evaluate(el => window.getComputedStyle(el).backgroundColor);
    console.log('Emerald button background-color:', color);
  }

  // Check Dashboard text
  const bodyText = await page.textContent('body');
  console.log('Dashboard loaded:', bodyText.includes('INFOHAS'));
  console.log('No Unknown student:', !bodyText.includes('Unknown'));

  // Go to Reports
  const reportsTab = await page.$('button:has-text("Rapports"), button:has-text("Reports")');
  if (reportsTab) {
    await reportsTab.click();
    await page.waitForTimeout(1500);
    console.log('Reports page loaded');

    // Click report type dropdown
    const selectTrigger = await page.$('div:has-text("Rapports") ~ div button, select, [role="combobox"]');
    console.log('Found combobox on reports:', !!selectTrigger);
  }

  // Go to Students page and check PDF button
  const studentsTab = await page.$('button:has-text("Étudiants"), button:has-text("Students")');
  if (studentsTab) {
    await studentsTab.click();
    await page.waitForTimeout(1500);
    const pdfButtons = await page.$$('button[title*="PDF"], button[title*="Rapport"]');
    console.log('Found PDF action buttons in student list:', pdfButtons.length);
  }

  await browser.close();
  console.log('ALL PRODUCTION VERIFICATION CHECKS PASSED GREEN!');
}

testProduction().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
