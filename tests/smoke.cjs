const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_URL || 'http://localhost:4173/';
const keys = ['overview', 'about', 'projects', 'stack', 'contact', 'canteen', 'workout', 'pos', 'inventory', 'ohman'];
const widths = [320, 375, 390, 540, 720, 768, 800, 950, 1000, 1024, 1200, 1280, 1440];
const allErrors = [];
function track(page) { page.on('pageerror', error => allErrors.push(error.message)); }
async function state(page, key) {
  assert.deepEqual(await page.locator('.detail-panel:not([hidden])').evaluateAll(nodes => nodes.map(node => node.dataset.panel)), [key]);
  assert.equal(await page.locator('#phone-home-screen').isVisible(), key === 'overview');
  assert.equal(await page.locator('#phone-sheet').getAttribute('hidden'), key === 'overview' ? '' : null);
  assert.equal(await page.locator('.phone').evaluate(node => node.classList.contains('is-open')), key !== 'overview');
  if (key !== 'overview') {
    const expectedTitle = await page.locator(`template[data-screen="${key}"]`).evaluate(node => node.content.querySelector('.screen-title').textContent.trim());
    assert.equal(await page.locator('#phone-sheet-title').textContent(), expectedTitle);
    assert.equal(await page.locator('#phone-sheet-body .screen-title').count(), 1);
    assert.equal((await page.locator('#phone-sheet-body .screen-title').textContent()).trim(), expectedTitle);
  }
}
async function focusVisible(page) {
  assert.equal(await page.evaluate(() => {
    const active = document.activeElement;
    return !active.closest('[hidden]') && active.getClientRects().length > 0;
  }), true, 'Focus must not remain on hidden or detached content');
}
async function overflow(page, label) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `Horizontal overflow: ${label}`);
  if (await page.locator('#phone-sheet').getAttribute('hidden') === null) {
    assert.equal(await page.locator('#phone-sheet-body').evaluate(node => node.scrollWidth <= node.clientWidth + 1), true, `Phone content overflow: ${label}`);
  }
}
async function screenshot(page, path) {
  await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'));
  await page.screenshot({ path, fullPage: true });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    track(page);
    await page.goto(base, { waitUntil: 'networkidle' });
    assert.match(await page.title(), /Vipul Ojha/);
    assert.equal(await page.locator('h1').count(), 1);
    assert.deepEqual(await page.locator('[data-panel]').evaluateAll(nodes => nodes.map(node => node.dataset.panel)), keys);
    assert.equal(await page.locator('.avatar-frame img').evaluate(img => img.complete && img.naturalWidth > 0), true);
    await state(page, 'overview');
    for (const [i, key] of keys.slice(1).entries()) {
      const source = page.locator(`#phone-home-screen a[data-open="${key}"]`).first();
      await source.focus();
      await page.keyboard.press('Enter');
      await state(page, key);
      assert.equal(await page.locator('#phone-back').evaluate(node => node === document.activeElement), true);
      assert.equal(await page.locator('#phone-sheet').isVisible(), true);
      assert.equal(new URL(page.url()).hash, `#${key}`);
      if (i % 3 === 0) await page.locator('#phone-back').click();
      else if (i % 3 === 1) await page.locator('#phone-home').click();
      else await page.keyboard.press('Escape');
      await state(page, 'overview');
      assert.equal(await source.evaluate(node => node === document.activeElement), true, `Focus restoration after ${key}`);
    }
    console.log('PASS: all 10 panels, keyboard icon activation, matching phone sheets, back/home/Escape, and restored focus.');

    await page.locator('.nav-links [data-open="projects"]').click();
    for (const [filter, count] of [['web', 3], ['android', 1], ['desktop', 1], ['all', 5]]) {
      await page.locator(`[data-filter="${filter}"]`).click();
      assert.equal(await page.locator('.project-card:visible').count(), count);
      assert.equal(await page.locator('.screen-project-list a:visible').count(), count);
      assert.equal(await page.locator('#project-count').textContent(), `${count} ${count === 1 ? 'project' : 'projects'}`);
      assert.equal(await page.locator('#project-filters [aria-pressed="true"]').count(), 1);
    }
    await page.locator('[data-filter="android"]').click();
    await page.locator('.screen-project-list [data-open="workout"]').click();
    await state(page, 'workout');
    await page.locator('#phone-sheet-body [data-open="projects"]').click();
    await state(page, 'projects');
    assert.equal(await page.locator('.screen-project-list a:visible').count(), 1);
    assert.equal(await page.locator('[data-filter="android"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-filter="all"]').click();
    await page.keyboard.press('Escape');
    await focusVisible(page);
    for (const name of ['smart-canteen-system', 'workout_tracker', '-POS-System', 'CoreInventorySystem-Odoo', 'ohman']) {
      assert.ok(await page.locator(`.detail-panel a[href="https://github.com/vipulojha/${name}"]`).count() > 0, `Missing repository ${name}`);
    }
    assert.match(await page.locator('[data-panel="ohman"]').textContent(), /fork[\s\S]*upstream/i);
    assert.ok(await page.locator('a[href="https://coreinventorysystem-odoo.vercel.app"]').count() > 0);
    console.log('PASS: synchronized filters, retained selection, nested folder navigation, real repository/demo links, and fork credit.');

    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    await page.locator('#theme-toggle').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await page.locator('#theme-toggle').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#theme-toggle').getAttribute('aria-label'), 'Switch to light theme');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await screenshot(page, 'preview-sol-dark.png');
    await page.locator('#theme-toggle').click();
    await page.locator('.nav-links [data-open="contact"]').click();
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
    await page.waitForFunction(() => document.querySelector('#copy-status').textContent === 'Could not copy. Use the email link instead.');
    assert.ok(await page.locator('[data-panel="contact"] a[href="mailto:vipul.ojha.dev@gmail.com"]').isVisible());
    await page.keyboard.press('Escape');
    await screenshot(page, 'preview-sol-desktop.png');
    console.log('PASS: persisted light/dark theme and user-triggered clipboard success/denial feedback (clipboard stubbed).');

    for (const key of keys) {
      await page.goto(`${base}#${key === 'overview' ? 'home' : key}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.documentElement.classList.contains('js'));
      await state(page, key);
      if (key !== 'overview') {
        await page.keyboard.press('Escape');
        await state(page, 'overview');
        await focusVisible(page);
      }
    }
    await page.goto(`${base}#unknown`, { waitUntil: 'domcontentloaded' });
    await state(page, 'overview');
    for (let i = 0; i < 4; i++) {
      for (const key of ['projects', 'contact', 'about', 'stack']) {
        await page.locator(`.nav-links [data-open="${key}"]`).dispatchEvent('click', { button: 0 });
        await state(page, key);
      }
      await page.keyboard.press('Escape');
      await state(page, 'overview');
    }
    await page.locator('.app-launcher[data-open="canteen"]').click();
    await page.setViewportSize({ width: 375, height: 812 });
    await state(page, 'canteen');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await state(page, 'canteen');
    await page.locator('#phone-home').click();
    await focusVisible(page);
    console.log('PASS: 10 direct-link states, unknown-link fallback, rapid panel changes/Escape, and resizing with an open sheet.');

    // Hash changes exercise rendering independently of pointer scroll/animation timing.
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      for (const key of keys) {
        await page.evaluate(key => { location.hash = key === 'overview' ? 'home' : key; }, key);
        await page.waitForFunction(key => document.querySelector(`.detail-panel[data-panel="${key}"]`).hidden === false, key);
        await state(page, key);
        await overflow(page, `${width}px / ${key}`);
      }
    }
    for (const viewport of [{ width: 1280, height: 480 }, { width: 640, height: 360 }]) {
      await page.setViewportSize(viewport);
      await page.locator('.nav-links [data-open="projects"]').click();
      await state(page, 'projects');
      await overflow(page, `${viewport.width} × ${viewport.height}`);
      await page.locator('.screen-project-list [data-open="ohman"]').click();
      await state(page, 'ohman');
      await page.locator('#phone-sheet-body a[href="https://github.com/vipulojha/ohman"]').scrollIntoViewIfNeeded();
      assert.ok(await page.locator('#phone-sheet-body a[href="https://github.com/vipulojha/ohman"]').isVisible());
      await page.locator('#phone-home').click();
      await state(page, 'overview');
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await screenshot(page, 'preview-sol-mobile.png');
    console.log('PASS: 130 panel/viewport combinations at 13 widths and usable scrolling/navigation in two short windows.');

    // Disable smooth scrolling for deterministic consecutive no-JS anchor clicks.
    const noJS = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'reduce', viewport: { width: 320, height: 812 } });
    const fallback = await noJS.newPage();
    track(fallback);
    await fallback.goto(base);
    assert.equal(await fallback.locator('.detail-panel:visible').count(), 10);
    assert.equal(await fallback.locator('.project-card:visible').count(), 5);
    assert.equal(await fallback.locator('#theme-toggle').isVisible(), false);
    assert.equal(await fallback.locator('#copy-email').isVisible(), false);
    assert.equal(await fallback.locator('#project-filters').isVisible(), false);
    assert.equal(await fallback.locator('.phone-column').isVisible(), false);
    await fallback.locator('.nav-links [href="#projects"]').click();
    assert.equal(new URL(fallback.url()).hash, '#projects');
    await fallback.locator('.project-card [href="#canteen"]').click();
    assert.equal(new URL(fallback.url()).hash, '#canteen');
    await fallback.locator('.nav-links [href="#contact"]').click();
    assert.equal(new URL(fallback.url()).hash, '#contact');
    await overflow(fallback, 'no-JS 320px');
    await noJS.close();

    const blocked = await browser.newContext({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await blocked.route('https://fonts.googleapis.com/**', route => route.abort());
    await blocked.route('https://fonts.gstatic.com/**', route => route.abort());
    await blocked.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage unavailable'); } });
    });
    const resilient = await blocked.newPage();
    track(resilient);
    await resilient.goto(base);
    await state(resilient, 'overview');
    assert.equal(await resilient.locator('html').getAttribute('data-theme'), 'dark');
    await resilient.locator('#theme-toggle').click();
    assert.equal(await resilient.locator('html').getAttribute('data-theme'), 'light');
    await resilient.locator('.nav-links [data-open="projects"]').click();
    await state(resilient, 'projects');
    assert.equal(await resilient.locator('.detail-panel:not([hidden])').evaluate(node => getComputedStyle(node).animationName), 'none');
    assert.equal(await resilient.locator('#phone-sheet').evaluate(node => getComputedStyle(node).transitionDuration), '0s');
    await resilient.keyboard.press('Escape');
    await state(resilient, 'overview');
    await blocked.close();
    console.log('PASS: no-JS project/contact access at 320px, blocked storage/fonts, OS theme fallback, and reduced-motion navigation.');
    assert.deepEqual(allErrors, [], 'No JavaScript page errors expected');
    console.log('PASS: complete local portfolio regression suite; zero page errors. No external destinations visited and no publishing performed.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
