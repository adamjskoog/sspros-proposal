/* Run where Chromium can launch. Screenshots still need human inspection. */
const { chromium } = require('playwright');
const { createServer } = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts', 'revision-browser');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.json':'application/json' };

async function main() {
  await fs.mkdir(output, { recursive: true });
  const server = createServer(async (req, res) => {
    try {
      const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
      const relative = path.relative(root, file);
      if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403); res.end(); return; }
      const data = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const files = ['index.html','service-concept.html','evaluation.html','brief.html','role-summary.html','website-review.html','downloads/office-kit/START-HERE.html'];
    for (const [label, width, height] of [['desktop',1440,1000],['phone',390,844],['narrow',320,740]]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      // Local fallback fonts make this check reproducible without external network access.
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      const overflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: horizontal overflow`);
      for (const file of files) {
        await page.goto(origin + '/' + file); await overflow();
        await page.screenshot({ path:path.join(output,`${label}-${path.basename(file,'.html')}.png`), fullPage:true });
      }
      await page.goto(origin + '/index.html');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.className), 'skip-link');
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#scenario').inputValue(),'C01');
      await page.locator('#prepare').click();
      assert.equal(await page.locator('#demo-result').isVisible(),true);
      await page.locator('#scenario').selectOption('C21'); await page.locator('#prepare').click();
      assert.equal(await page.locator('#copy-draft').isVisible(),false);
      await page.locator('#case-chips button').filter({ hasText:'Spanish' }).click();
      assert.equal(await page.evaluate(() => document.activeElement.id),'scenario');
      await page.locator('.model-notes summary').click();
      await overflow();
      await page.locator('a[href="#value-form"]').click();
      await page.locator('#requests').fill('0');
      assert.equal(await page.locator('#hours').textContent(),'-1.0');
      await page.locator('#requests').fill('');
      assert.equal(await page.locator('#value-error').isVisible(),true);
      await page.locator('#requests').fill('20');
      await page.locator('#ai-pilot details:not([open]) summary').evaluateAll(elements => elements.forEach(el => el.click()));
      await overflow();
      await page.screenshot({ path:path.join(output,`${label}-expanded.png`), fullPage:true });
      assert.deepEqual(errors,[]);
      await page.close();
    }
    const fallback = await browser.newPage({ viewport: {width:390,height:844} });
    await fallback.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await fallback.route('**/eval-results.js', route => route.abort());
    await fallback.goto(origin + '/index.html');
    assert.equal(await fallback.locator('#demo-mode').textContent(),'Illustrative fallback');
    await fallback.locator('#prepare').click();
    assert.match(await fallback.locator('#draft-label').textContent(),/ILLUSTRATIVE/);
    await fallback.screenshot({ path:path.join(output,'phone-fallback.png'), fullPage:true });
    console.log('PASS: browser interactions and overflow checks. Visually inspect screenshots in ' + output);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
