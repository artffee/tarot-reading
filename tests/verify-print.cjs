/* Real Chromium/PDF checks. No production dependencies or build step. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const { PDFDocument, PDFName, PDFArray, decodePDFRawStream } = require('pdf-lib');

const root = path.resolve(__dirname, '..');
const artifacts = path.join(__dirname, 'output');
const ids = Array.from({ length: 34 }, (_, index) => String(index + 5).padStart(2, '0'));
const artPaths = [...ids.map(id => `/cards/${id}.webp`), '/cards/back.webp'];
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

async function main() {
  await fs.mkdir(artifacts, { recursive: true });
  const server = http.createServer(async (request, response) => {
    try {
      let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const file = path.resolve(root, `.${pathname}`);
      if (!file.startsWith(`${root}${path.sep}`)) throw new Error('Outside root');
      const content = await fs.readFile(file);
      response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      response.end(content);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage({ viewport: { width: 1360, height: 1050 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.goto(`${origin}/deck/print.html`);
    const ready = () => page.waitForFunction(() => document.body.dataset.ready === 'true');
    await ready();

    // Every URL serves the exact original file, not an HTML fallback or a placeholder.
    for (const artPath of artPaths) {
      const response = await page.request.get(`${origin}${artPath}`);
      assert.equal(response.status(), 200, artPath);
      assert.match(response.headers()['content-type'], /image\/webp/);
      assert.deepEqual(await response.body(), await fs.readFile(path.join(root, artPath)));
    }
    assert.equal(await page.locator('#print-button').isEnabled(), true);
    assert.equal(await page.locator('#print-sheets').isVisible(), false);
    await page.screenshot({ path: path.join(artifacts, 'desktop.png'), fullPage: true });
    await page.locator('#next').click();
    assert.equal(await page.locator('#preview-canvas .sheet').getAttribute('data-side'), 'back');
    await page.locator('#previous').click();
    assert.equal(await page.locator('#preview-canvas .sheet').getAttribute('data-side'), 'front');

    // Independent expected slot orders catch padding/mirroring regressions on sheet 6.
    for (const paper of ['letter', 'a4']) {
      await page.selectOption('#paper', paper);
      for (const flip of ['long', 'short']) {
        await page.selectOption('#flip', flip);
        for (const sides of ['duplex', 'fronts', 'backs']) {
          await page.selectOption('#sides', sides);
          await ready();
          const expected = [];
          for (let sheet = 1; sheet <= 6; sheet++) {
            const front = Array.from({ length: 6 }, (_, i) => ids[(sheet - 1) * 6 + i] || '');
            const back = (flip === 'long' ? [2, 1, 0, 5, 4, 3] : [3, 4, 5, 0, 1, 2]).map(i => front[i]);
            if (sides !== 'backs') expected.push({ sheet: String(sheet), side: 'front', cards: front });
            if (sides !== 'fronts') expected.push({ sheet: String(sheet), side: 'back', cards: back });
          }
          const actual = await page.locator('#print-sheets .sheet').evaluateAll(sheets => sheets.map(sheet => ({
            sheet: sheet.dataset.sheet, side: sheet.dataset.side,
            cards: [...sheet.querySelectorAll('.card')].map(card => card.dataset.card)
          })));
          assert.deepEqual(actual, expected, `${paper} ${flip} ${sides} slot order`);

          await page.emulateMedia({ media: 'print' });
          assert.equal(await page.locator('.workspace').isVisible(), false);
          assert.equal(await page.locator('.site-header').isVisible(), false);
          assert.equal(await page.locator('#print-warning').isVisible(), false);
          assert.equal(await page.locator('#print-sheets').isVisible(), true);
          // Dimensions, safe borders, unclipped images, and guides on every populated slot.
          const geometry = await page.locator('#print-sheets .sheet').evaluateAll(sheets => sheets.map(sheet => {
            const rect = sheet.getBoundingClientRect();
            return {
              width: rect.width, height: rect.height,
              cards: [...sheet.querySelectorAll('.card:not(.empty)')].map(card => {
                const c = card.getBoundingClientRect();
                const image = card.querySelector('img');
                const i = image.getBoundingClientRect();
                const guide = card.querySelector('svg').getBoundingClientRect();
                return {
                  width: c.width, height: c.height, imageWidth: i.width, imageHeight: i.height,
                  fit: getComputedStyle(image).objectFit,
                  loaded: image.complete && image.naturalWidth > 0,
                  borderX: i.left - c.left, borderY: i.top - c.top,
                  margins: [guide.left - rect.left, rect.right - guide.right, guide.top - rect.top, rect.bottom - guide.bottom]
                };
              })
            };
          }));
          const pxPerMm = 96 / 25.4;
          for (const sheet of geometry) {
            assert.ok(Math.abs(sheet.width / pxPerMm - (paper === 'a4' ? 210 : 215.9)) < .05);
            assert.ok(Math.abs(sheet.height / pxPerMm - (paper === 'a4' ? 297 : 279.4)) < .05);
            for (const card of sheet.cards) {
              assert.ok(Math.abs(card.width / pxPerMm - 60) < .05);
              assert.ok(Math.abs(card.height / pxPerMm - 90) < .05);
              assert.equal(card.fit, 'contain');
              assert.equal(card.loaded, true);
              assert.ok(card.borderX / pxPerMm >= 1.99 && card.borderY / pxPerMm >= 1.99);
              assert.ok(card.margins.every(margin => margin / pxPerMm >= 8.9));
            }
          }
          const name = `${paper}-${flip}-${sides}`;
          // Backgrounds intentionally disabled: artwork and cut guides must still print.
          const bytes = await page.pdf({ path: path.join(artifacts, `${name}.pdf`), preferCSSPageSize: true, printBackground: false, displayHeaderFooter: false });
          await checkPdf(bytes, paper, expected);
          await page.emulateMedia({ media: 'screen' });
        }
      }
      await page.selectOption('#back-order', 'reverse');
      await ready();
      const reversed = await page.locator('#print-sheets .sheet').evaluateAll(sheets => sheets.map(sheet => Number(sheet.dataset.sheet)));
      assert.deepEqual(reversed, [6, 5, 4, 3, 2, 1]);
      await page.selectOption('#back-order', 'forward');
      await page.selectOption('#sides', 'duplex');
      await page.check('#test-sheet');
      await ready();
      await page.emulateMedia({ media: 'print' });
      const testPdf = await PDFDocument.load(await page.pdf({ path: path.join(artifacts, `${paper}-test.pdf`), preferCSSPageSize: true }));
      assert.equal(testPdf.getPageCount(), 2, 'First sheet test must be one front and one back');
      await page.emulateMedia({ media: 'screen' });
      await page.uncheck('#test-sheet');
    }

    await page.selectOption('#flip', 'long');
    await page.selectOption('#paper', 'letter');
    await ready();
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForFunction(() => document.querySelector('#preview-stage').offsetHeight > 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No overflow at ${width}px`);
      await page.screenshot({ path: path.join(artifacts, `screen-${width}.png`), fullPage: true });
    }
    // The print button invokes print only once all images are ready.
    await page.evaluate(() => { window.print = () => { window.printCalls = (window.printCalls || 0) + 1; }; });
    await page.locator('#print-button').click();
    assert.equal(await page.evaluate(() => window.printCalls), 1);
    assert.deepEqual(errors, [], 'No browser errors or broken local requests');

    // Native printing also has an explicit failure page instead of missing cards.
    const broken = await browser.newPage();
    await broken.route('**/cards/17.webp', route => route.fulfill({ status: 404, body: 'Missing' }));
    await broken.goto(`${origin}/deck/print.html`);
    await broken.waitForSelector('#asset-status.error');
    assert.equal(await broken.locator('#print-button').isDisabled(), true);
    await broken.emulateMedia({ media: 'print' });
    assert.equal(await broken.locator('#print-sheets').isVisible(), false);
    assert.equal(await broken.locator('#print-warning').isVisible(), true);
    await broken.emulateMedia({ media: 'screen' });
    await broken.unroute('**/cards/17.webp');
    await broken.locator('#retry').click();
    await broken.waitForFunction(() => document.body.dataset.ready === 'true');
    const noJs = await browser.newPage({ javaScriptEnabled: false });
    await noJs.goto(`${origin}/deck/print.html`);
    await noJs.emulateMedia({ media: 'print' });
    assert.equal(await noJs.locator('#print-warning').isVisible(), true);
    const gallery = await fs.readFile(path.join(root, 'deck/index.html'), 'utf8');
    assert.match(gallery, /href="\/deck\/print\.html"/);
    console.log('PASS: 35 original image paths; 12 paper/flip/side PDFs; 2 alignment-test PDFs; page sizes/counts; 34 fronts and 34 backs; mirrored final slots; reverse back order; cut geometry; mobile preview; print button; missing-image recovery; no-JS guard.');
    console.log(`Review PDFs and screenshots in ${artifacts}`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

async function checkPdf(bytes, paper, expected) {
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), expected.length, 'No split sheets or trailing blank pages');
  const dimensions = paper === 'a4' ? [595.28, 841.89] : [612, 792];
  pdf.getPages().forEach((page, index) => {
    const size = page.getSize();
    assert.ok(Math.abs(size.width - dimensions[0]) < 1);
    assert.ok(Math.abs(size.height - dimensions[1]) < 1);
    const contents = page.node.lookup(PDFName.of('Contents'));
    const streams = contents instanceof PDFArray ? contents.asArray().map(ref => pdf.context.lookup(ref)) : [contents];
    const commands = streams.map(stream => Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1')).join('\n');
    // Chromium emits one image XObject draw for each card. This proves that the
    // final 4-card sheet stays intact in the actual PDF, not merely in the DOM.
    const images = commands.match(/\/X\d+\s+Do\b/g) || [];
    assert.equal(images.length, expected[index].cards.filter(Boolean).length, `PDF page ${index + 1}: card count`);
    // Measure the actual PDF transforms, not just CSS boxes. Transformed layout
    // overflow can silently make Chromium shrink an otherwise correctly sized page.
    const placements = imagePlacements(commands);
    const mmPerPoint = 25.4 / 72;
    const paperWidth = paper === 'a4' ? 210 : 215.9;
    const paperHeight = paper === 'a4' ? 297 : 279.4;
    let imageIndex = 0;
    expected[index].cards.forEach((id, slot) => {
      if (!id) return;
      const [a, b, c, d, e, f] = placements[imageIndex++];
      const artHeight = expected[index].side === 'back' ? 56 * 1450 / 1024 : 56 * (id === '05' ? 1500 : 1502) / 1000;
      const left = Math.min(e, e + a, e + c, e + a + c) * mmPerPoint;
      const top = (size.height - Math.max(f, f + b, f + d, f + b + d)) * mmPerPoint;
      const targetLeft = (paperWidth - 188) / 2 + (slot % 3) * 64 + 2;
      const targetTop = (paperHeight - 184) / 2 + Math.floor(slot / 3) * 94 + 2 + (86 - artHeight) / 2;
      assert.ok(Math.abs(Math.hypot(a, b) * mmPerPoint - 56) < .25, 'PDF artwork width must be 56 mm at actual size');
      assert.ok(Math.abs(Math.hypot(c, d) * mmPerPoint - artHeight) < .25, 'PDF artwork must preserve its original aspect ratio');
      assert.ok(Math.abs(left - targetLeft) < .25 && Math.abs(top - targetTop) < .25, `PDF page ${index + 1}, slot ${slot}: duplex position`);
    });
  });
}

function imagePlacements(commands) {
  let matrix = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const images = [];
  for (const line of commands.split('\n').map(line => line.trim())) {
    if (line === 'q') stack.push([...matrix]);
    else if (line === 'Q') matrix = stack.pop();
    else if (line.endsWith(' cm')) {
      const [a, b, c, d, e, f] = line.slice(0, -3).split(/\s+/).map(Number);
      const [aa, bb, cc, dd, ee, ff] = matrix;
      matrix = [aa * a + cc * b, bb * a + dd * b, aa * c + cc * d, bb * c + dd * d, aa * e + cc * f + ee, bb * e + dd * f + ff];
    } else if (/^\/X\d+\s+Do$/.test(line)) images.push([...matrix]);
  }
  return images;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
