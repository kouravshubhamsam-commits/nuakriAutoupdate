import { test } from '@playwright/test';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
const HOME_URL = 'https://www.naukri.com';
const LOGIN_URL = 'https://www.naukri.com/nlogin/login';
const PROFILE_URL = 'https://www.naukri.com/mnjuser/profile';

test('Naukri profile theme update workflow', async ({ page, context }) => {
  const email = process.env.NAUKRI_EMAIL;
  const password = process.env.NAUKRI_PASSWORD?.trim();

  if (!email || !password) {
    throw new Error('Missing NAUKRI_EMAIL or NAUKRI_PASSWORD environment variables');
  }

  await context.setExtraHTTPHeaders({
    'accept-language': 'en-US,en;q=0.9',
    referer: HOME_URL,
    'sec-ch-ua': '"Chromium";v="121", "Google Chrome";v="121", ";Not A Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
    window.chrome = { runtime: {} };
  });

  try {
    console.log('1️⃣ Navigating to Naukri homepage');
    await page.goto(HOME_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);

    const homeUrl = page.url();
    const homeBody = await page.textContent('body');
    console.log(`   Homepage URL: ${homeUrl}`);
    console.log(`   Page snippet: ${homeBody?.slice(0, 120).replace(/\s+/g, ' ')}`);

    if (homeBody?.includes('Access Denied') || homeBody?.includes('Error 404') || homeBody?.includes('Page not found')) {
      throw new Error(`Homepage blocked or not accessible: ${homeUrl}`);
    }

    const loginLink = page.locator('a[href*="/nlogin/login"], text=Login').first();
    if (await loginLink.count()) {
      await loginLink.click();
      await page.waitForURL(/nlogin\/login/, { timeout: 30000 }).catch(() => null);
    } else {
      console.log('   Login link not found on homepage, navigating directly to login URL.');
      await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 60000 });
    }
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    const pageBody = await page.textContent('body');
    console.log(`   URL: ${currentUrl}`);
    console.log(`   Page snippet: ${pageBody?.slice(0, 120).replace(/\s+/g, ' ')}`);

    if (pageBody?.includes('Access Denied') || pageBody?.includes('Error 404') || pageBody?.includes('Page not found')) {
      throw new Error(`Login page blocked or not accessible: ${currentUrl}`);
    }

    const loginFormVisible = await page.locator('#usernameField').isVisible().catch(() => false);
    if (!loginFormVisible) {
      throw new Error('Login form did not load correctly on the login page');
    }

    console.log('2️⃣ Filling login form');
    await page.locator('#usernameField').fill(email, { delay: 50 });
    await page.locator('#passwordField').fill(password, { delay: 50 });
    await page.locator('button:has-text("Login")').first().click();
    await page.waitForTimeout(7000);

    const postLoginUrl = page.url();
    console.log(`   Post-login URL: ${postLoginUrl}`);

    const loginFailed = await page
      .locator('text=/Invalid|incorrect|Try again|OTP/')
      .first()
      .isVisible()
      .catch(() => false);
    if (loginFailed) {
      throw new Error('Login failed: invalid credentials or additional verification required');
    }

    console.log('3️⃣ Clicking View Profile');
    let viewProfileLink = page.locator('a[href="/mnjuser/profile"]');
    if (!(await viewProfileLink.count())) {
      viewProfileLink = page.locator('text=View Profile');
    }
    await viewProfileLink.first().waitFor({ timeout: 20000 });
    await viewProfileLink.first().click();
    await page.waitForURL('**/mnjuser/profile', { timeout: 60000 });
    await page.waitForTimeout(2000);

    const profileUrl = page.url();
    if (!profileUrl.includes('/profile')) {
      throw new Error('Failed to reach profile page after login');
    }
    console.log(`   Profile URL: ${profileUrl}`);

    console.log('4️⃣ Clicking Edit theme icon');
    const editBtn = page.locator('em', { hasText: 'editOneTheme' }).first();
    await editBtn.waitFor({ timeout: 15000 });
    await editBtn.click();
    await page.waitForTimeout(2000);

    console.log('5️⃣ Clicking Save button');
    await page.locator('#saveBasicDetailsBtn').first().click();
    await page.waitForTimeout(2000);

    console.log('\n✅ Workflow completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    throw error;
  }
});
