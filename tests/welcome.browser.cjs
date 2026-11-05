const assert = require('node:assert/strict');
const { chromium } = require('/Users/ryanelmore/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    const errors = [];page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.APP_URL || 'http://127.0.0.1:4173');
    assert.equal(await page.getByText('What would you like to track?', { exact: true }).count(), 0);
    for (const width of [320, 375, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      const result = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, scale: visualViewport.scale, fonts: [...document.querySelectorAll('input')].map(el => parseFloat(getComputedStyle(el).fontSize)) }));
      assert.equal(result.overflow, false);assert.equal(result.scale, 1);assert(result.fonts.every(size => size >= 16));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[name=name]').fill('Sample');await page.locator('[name=age]').fill('30');
    await page.getByRole('button', { name: 'Get Started', exact: true }).click();
    assert(await page.getByRole('heading', { name: 'What would you like to track?' }).isVisible());
    assert.equal(await page.locator('[name=name]').count(), 0);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    assert(await page.getByText('Choose at least one option, or select Skip for now.').isVisible());
    await page.locator('.tracking-option').filter({ hasText: /^Headaches$/ }).click();
    await page.locator('.tracking-option').filter({ hasText: /^Migraines$/ }).click();
    await page.locator('.tracking-option').filter({ hasText: /^Other$/ }).click();
    assert(await page.locator('[name=goal]').isVisible());await page.locator('[name=goal]').fill('Sleep patterns');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    assert.equal(await page.locator('[name=name]').inputValue(), 'Sample');
    await page.getByRole('button', { name: 'Get Started', exact: true }).click();
    assert(await page.locator('[value=headaches]').isChecked());assert(await page.locator('[value=migraines]').isChecked());
    assert.equal(await page.locator('[name=goal]').inputValue(), 'Sleep patterns');
    for (const width of [320,375,390,430]) {
      await page.setViewportSize({ width, height: 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'docs/screenshots/tracking-goals-mobile.png', scale: 'css' });
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    let state = await page.evaluate(() => JSON.parse(localStorage.getItem('headache-tracker.v1')));
    assert.equal(state.onboardingComplete, true);assert.deepEqual(state.profile.trackingGoals, ['headaches','migraines','other']);assert.equal(state.profile.goal, 'Sleep patterns');
    await page.reload();assert(await page.getByRole('heading', { name: /Sample/ }).isVisible());
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    assert(await page.locator('[value=migraines]').isChecked());assert.equal(await page.locator('[name=goal]').inputValue(), 'Sleep patterns');
    await page.locator('.tracking-option').filter({ hasText: /^Other$/ }).click();assert.equal(await page.locator('[name=goal]').isVisible(), false);
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    state = await page.evaluate(() => JSON.parse(localStorage.getItem('headache-tracker.v1')));assert.equal(state.profile.goal, '');assert.deepEqual(state.profile.trackingGoals,['headaches','migraines']);
    await page.getByRole('button', { name: 'Reset welcome', exact: true }).click();assert(await page.getByRole('button',{name:'Get Started',exact:true}).isVisible());
    await page.getByRole('button', { name: 'Skip for now', exact: true }).click();assert(await page.getByRole('button', { name: /Log Headache/ }).first().isVisible());
    await page.evaluate(() => { const state=JSON.parse(localStorage.getItem('headache-tracker.v1'));delete state.profile.trackingGoals;state.profile.goal='My old goal';localStorage.setItem('headache-tracker.v1',JSON.stringify(state)); });
    await page.reload();await page.getByRole('button', { name: 'Settings', exact: true }).click();assert(await page.locator('[value=other]').isChecked());assert.equal(await page.locator('[name=goal]').inputValue(),'My old goal');
    assert.deepEqual(errors,[]);console.log('PASS: two-step welcome, multiple goals, Other visibility, back/next, persistence, settings, skip/reset, legacy goals, mobile fit and 16px inputs.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error);process.exit(1); });
