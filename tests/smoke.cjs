const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.SITE_URL || 'http://localhost:4173/', { waitUntil: 'networkidle' });
    assert.match(await page.title(), /Vipul Ojha/);
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.locator('.project-card:visible').count(), 5);
    assert.equal(await page.locator('.avatar-frame img').evaluate(img => img.complete && img.naturalWidth > 0), true);
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    for (const [filter, count] of [['web', 3], ['android', 1], ['desktop', 1], ['all', 5]]) {
      await page.locator(`[data-filter="${filter}"]`).click();
      assert.equal(await page.locator('.project-card:visible').count(), count);
      assert.equal(await page.locator('#project-count').textContent(), `${count} ${count === 1 ? 'project' : 'projects'}`);
      assert.equal(await page.locator('#project-filters [aria-pressed="true"]').count(), 1);
    }
    await page.locator('#theme-toggle').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await page.locator('#theme-toggle').getAttribute('aria-pressed'), 'true');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.locator('#theme-toggle').click();
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.copiedEmail = value; } } });
    });
    await page.locator('#copy-email').click();
    await page.waitForFunction(() => document.querySelector('#copy-status').textContent === 'Email copied to clipboard.');
    assert.equal(await page.evaluate(() => window.copiedEmail), 'vipul.ojha.dev@gmail.com');
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
    });
    await page.locator('#copy-email').click();
    await page.waitForFunction(() => document.querySelector('#copy-status').textContent.includes('Could not copy'));
    await page.locator('.brand').click();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: 'preview-desktop.png', fullPage: true });
    for (const width of [320, 375, 390, 540, 720, 768, 800, 950, 1000, 1024, 1200, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `Overflow at ${width}px`);
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.locator('#menu-toggle').click();
    assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'false');
    await page.locator('#menu-toggle').click();
    await page.locator('.nav-links a[href="#projects"]').click();
    assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'false');
    assert.equal(new URL(page.url()).hash, '#projects');
    await page.locator('.brand').click();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: 'preview-mobile.png', fullPage: true });
    assert.deepEqual(errors, []);
    const noJS = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
    const fallback = await noJS.newPage();
    await fallback.goto(process.env.SITE_URL || 'http://localhost:4173/');
    assert.equal(await fallback.locator('.project-card:visible').count(), 5);
    assert.equal(await fallback.locator('#theme-toggle').isVisible(), false);
    assert.equal(await fallback.locator('.nav-links').isVisible(), true);
    await fallback.locator('.nav-links a[href="#contact"]').click();
    assert.equal(new URL(fallback.url()).hash, '#contact');
    const blocked = await browser.newContext({ colorScheme: 'dark' });
    await blocked.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage unavailable'); } }); });
    const resilient = await blocked.newPage();
    await resilient.goto(process.env.SITE_URL || 'http://localhost:4173/');
    assert.equal(await resilient.locator('html').getAttribute('data-theme'), 'dark');
    await resilient.locator('#theme-toggle').click();
    assert.equal(await resilient.locator('html').getAttribute('data-theme'), 'light');
    console.log('PASS: project filters, persisted theme, blocked storage, clipboard success/failure, mobile menu, native anchors, no-JS fallback, and 13 viewport widths from 320 to 1440px.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
