/* Smoke test: opens every game in a phone-sized headless browser, plays it
   with a dumb bot at high speed until game over, and reports any JS errors.
   Usage:  python3 -m http.server 8765   (in the repo root, separate terminal)
           node tools/smoke-test.js      (needs: npm i -g playwright) */
const { chromium, devices } = require('playwright');
const URL = process.env.URL || 'http://localhost:8765/';
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  const ids = await page.evaluate(() => CG.games.map((g) => g.id));
  for (const id of ids) {
    await page.goto(URL + '#/' + id);
    await page.waitForTimeout(300);
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => {
      const { inst } = CG.debug(), ptr = CG.input.pointer;
      let s = 0;
      for (; s < 120 * 300 && CG.debug().state === 'playing'; s++) {
        ptr.x = 180 + Math.sin(s / 90) * 150; ptr.moved = true;
        ptr.justDown = s % 240 === 0;
        inst.update(1 / 120);
      }
      inst.draw(document.createElement('canvas').getContext('2d'), 'over');
      return { seconds: Math.round(s / 120), state: CG.debug().state };
    });
    console.log(id.padEnd(16), r.state.padEnd(8), r.seconds + 's simulated');
  }
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'OK - no errors');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
