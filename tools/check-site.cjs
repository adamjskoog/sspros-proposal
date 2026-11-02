const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');

async function run({ pdf = false } = {}) {
  const root = path.resolve(__dirname, '..');
  const artifacts = path.join(root, 'artifacts');
  fs.mkdirSync(artifacts, { recursive: true });
  const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.zip': 'application/zip' };
  const server = http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
      const content = fs.readFileSync(file);
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(content);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const candidates = [process.env.BROWSER_PATH, await puppeteer.executablePath(), 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
  const executablePath = candidates.find(file => file && fs.existsSync(file));
  let browser;
  const checks = [];
  const errors = [];
  try {
    browser = await puppeteer.launch({ executablePath, headless: true });
    const page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(base, { waitUntil: 'networkidle0' });
    assert.equal(await page.$eval('#scenario', el => el.value), 'C01');
    assert.match(await page.$eval('#prepare', el => el.textContent), /View saved AI result/);
    await page.click('#prepare');
    assert.equal(await page.$eval('#result-draft', el => el.textContent), await page.evaluate(() => window.EVAL_RESULTS.cases.find(item => item.id === 'C01').handoff.draft_reply));
    checks.push('Ordinary C01 inquiry is first; displayed output matches the saved evaluation.');
    await page.select('#scenario', 'C25');
    assert.equal(await page.$eval('#demo-result', el => el.hidden), true);
    await page.click('#prepare');
    assert.equal(await page.$eval('#copy-draft', el => el.hidden), true);
    assert.equal(await page.$eval('#review-badge', el => el.textContent), 'Human escalation');
    await page.click('#hard-cases summary');
    await page.click('#case-chips button:last-child');
    assert.equal(await page.$eval('#scenario', el => el.value), 'C37');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'scenario');
    checks.push('Emergency route has no draft; difficult-case navigation selects and focuses the matching example.');
    await page.select('#scenario', 'C01');
    await page.click('#prepare');
    await page.click('#value-estimate summary');
    assert.equal(await page.$eval('#hours', el => el.textContent), '72');
    await page.$eval('#review', el => { el.value = '12'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.ok(Number(await page.$eval('#hours', el => el.textContent)) < 0);
    assert.match(await page.$eval('#value-direction', el => el.textContent), /adds .* hours of work/);
    await page.$eval('#review', el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await page.$eval('#hours', el => el.textContent), '—');
    assert.equal(await page.$eval('#review', el => el.getAttribute('aria-invalid')), 'true');
    await page.$eval('#review', el => { el.value = '2'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.$eval('#requests', el => { el.value = '0'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await page.$eval('#hours', el => el.textContent), '-32');
    assert.equal(await page.$eval('#ai-year', el => el.textContent), '$0.00');
    await page.$eval('#requests', el => { el.value = '20'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    checks.push('Calculator handles defaults, negative time, invalid fields, recovery, and zero-traffic overhead.');
    const mainLinks = await page.$$eval('a[href^="mailto:"]', elements => elements.map(el => el.getAttribute('href')));
    assert.ok(mainLinks.length >= 4 && mainLinks.every(href => href.startsWith('mailto:adamjskoog@gmail.com')));
    checks.push('Direct contact links use the supplied email address.');

    for (const file of ['index.html', 'service-concept.html', 'brief.html', 'role-summary.html']) {
      await page.goto(base + '/' + file, { waitUntil: 'networkidle0' });
      const ids = await page.$$eval('[id]', elements => elements.map(el => el.id));
      assert.equal(ids.length, new Set(ids).size, 'Duplicate IDs in ' + file);
      const links = await page.$$eval('a[href],link[href],script[src]', elements => elements.map(el => el.getAttribute('href') || el.getAttribute('src')));
      for (const link of links) {
        if (/^(https?:|mailto:|tel:|data:)/.test(link)) continue;
        const [target, hash] = link.split('#');
        const targetFile = path.resolve(root, target || file);
        assert.ok(fs.existsSync(targetFile), file + ' missing ' + link);
        if (hash) assert.ok(fs.readFileSync(targetFile, 'utf8').includes('id="' + hash + '"'), 'Missing anchor ' + link);
      }
      for (const width of [1440, 768, 390, 320]) {
        await page.setViewport({ width, height: 1000 });
        await page.evaluate(() => document.querySelectorAll('details').forEach(el => { el.open = true; }));
        const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        assert.equal(overflowing, false, file + ' overflows at ' + width);
      }
      await page.setViewport({ width: 1440, height: 1000 });
      await page.evaluate(() => { document.querySelectorAll('details').forEach(el => { el.open = false; }); window.scrollTo(0, 0); });
      await page.screenshot({ path: path.join(artifacts, file.replace('.html', '-desktop.png')), fullPage: true });
      if (file === 'index.html') {
        await page.screenshot({ path: path.join(artifacts, 'hero-desktop.png') });
        await page.setViewport({ width: 390, height: 844 });
        await page.screenshot({ path: path.join(artifacts, 'hero-mobile.png') });
      }
      if (pdf && ['brief.html', 'role-summary.html'].includes(file)) {
        const output = file === 'brief.html' ? 'SSPros-Decision-Brief.pdf' : 'SSPros-Role-Summary.pdf';
        await page.pdf({ path: path.join(root, 'downloads', output), format: 'Letter', printBackground: true, preferCSSPageSize: true });
      }
      checks.push(file + ': valid local links and anchors; no overflow at 1440, 768, 390, or 320px.');
    }
    // When results fail to load, preset content must not be described as a real model run.
    const fallback = await browser.newPage();
    await fallback.setRequestInterception(true);
    fallback.on('request', request => request.url().endsWith('/eval-results.js') ? request.abort() : request.continue());
    await fallback.goto(base, { waitUntil: 'networkidle0' });
    assert.equal(await fallback.$eval('#demo-mode', el => el.textContent), 'Illustrative examples');
    assert.match(await fallback.$eval('#prepare', el => el.textContent), /View example handoff/);
    await fallback.close();
    checks.push('Missing evaluation data is clearly labeled as illustrative fallback content.');
    const noScript = await browser.newPage();
    await noScript.setJavaScriptEnabled(false);
    await noScript.goto(base, { waitUntil: 'networkidle0' });
    assert.match(await noScript.$eval('main', el => el.textContent), /One useful first assignment/);
    assert.ok(await noScript.$('a[href^="mailto:adamjskoog@gmail.com"]'));
    await noScript.close();
    checks.push('Proposal and contact remain available without JavaScript.');
    assert.deepEqual(errors, [], 'Browser JavaScript errors');
    fs.writeFileSync(path.join(artifacts, 'browser-checks.json'), JSON.stringify({ checks, errors, generatedPdfs: pdf }, null, 2));
    return { checks, errors, generatedPdfs: pdf };
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
module.exports = { run };
if (require.main === module) run({ pdf: process.argv.includes('--pdf') }).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
