/* Real Chromium: separate collections, every sheet, both duplex edges and mobile downloads. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const { PDFDocument } = require('pdf-lib');
const root = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'output');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.webp':'image/webp','.pdf':'application/pdf','.svg':'image/svg+xml'};

async function main() {
  await fs.mkdir(output, {recursive:true});
  const cards = JSON.parse(await fs.readFile(path.join(root,'decks/gothic/content.json')));
  const manifest = JSON.parse(await fs.readFile(path.join(root,'decks/gothic/downloads/manifest.json')));
  const server = http.createServer(async (request,response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url,'http://local').pathname);
      let file = path.resolve(root,`.${pathname}`);
      if (!file.startsWith(root+path.sep)) throw Error('Outside root');
      const stat = await fs.stat(file).catch(()=>null);
      if (stat?.isDirectory()) file=path.join(file,'index.html');
      else if (!stat && !path.extname(file)) file += '.html';
      const data = await fs.readFile(file);
      response.writeHead(200, {'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':data.length});
      response.end(data);
    } catch { response.writeHead(404);response.end('Not found'); }
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin=`http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
    const context=await browser.newContext({viewport:{width:1360,height:1050},acceptDownloads:true});
    await context.addInitScript(()=>localStorage.setItem('cp-consent','denied'));
    // Fonts are optional on the deployed gallery; avoid external network in local tests.
    await context.route('https://fonts.**/*',route=>route.abort());
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    await page.goto(`${origin}/decks/gothic/print`);
    const ready=()=>page.waitForFunction(()=>document.body.dataset.ready==='true');
    await ready();
    assert.match(await page.title(),/Nocturne Cathedral/);
    assert.equal(await page.locator('#print-sheets .sheet').count(),26);
    const served=await page.request.get(`${origin}/cards/gothic/back.webp`);
    assert.equal(hash(await served.body()),hash(await fs.readFile(path.join(root,'cards/gothic/back.webp'))));
    for (const paper of ['letter','a4']) for (const flip of ['long','short']) {
      await page.selectOption('#paper',paper);await page.selectOption('#flip',flip);
      for (const sides of ['duplex','fronts','backs']) for (const test of [false,true]) {
        await page.selectOption('#sides',sides);await page.locator('#test-sheet').setChecked(test);await ready();
        const sheets=await page.locator('#print-sheets .sheet').evaluateAll(nodes=>nodes.map(sheet=>({
          sheet:Number(sheet.dataset.sheet),side:sheet.dataset.side,
          cards:[...sheet.querySelectorAll('.card')].map(card=>({id:card.dataset.card,src:card.querySelector('img')?.getAttribute('src')}))
        })));
        const expected=[];
        for (let n=0;n<(test?1:13);n++) for (const side of ['front','back']) {
          if ((sides==='fronts'&&side==='back')||(sides==='backs'&&side==='front'))continue;
          const map=side==='front'?[0,1,2,3,4,5]:flip==='long'?[2,1,0,5,4,3]:[3,4,5,0,1,2];
          expected.push({sheet:n+1,side,cards:map.map(i=>({id:cards[n*6+i].id,src:side==='front'?cards[n*6+i].image:'/cards/gothic/back.webp'}))});
        }
        assert.deepEqual(sheets,expected,`${paper} ${flip} ${sides} test=${test}`);
        await page.emulateMedia({media:'print'});
        assert.equal(await page.locator('.workspace').isVisible(),false);
        assert.equal(await page.locator('#print-warning').isVisible(),false);
        const geometry=await page.locator('#print-sheets .sheet').evaluateAll(nodes=>nodes.map(sheet=>{
          const s=sheet.getBoundingClientRect();return {w:s.width,h:s.height,cards:[...sheet.querySelectorAll('.card')].map(card=>{
            const c=card.getBoundingClientRect(),i=card.querySelector('img'),a=i.getBoundingClientRect(),g=card.querySelector('svg').getBoundingClientRect();
            return {w:c.width,h:c.height,inset:a.left-c.left,fit:getComputedStyle(i).objectFit,loaded:i.complete&&i.naturalWidth===896,
              margins:[g.left-s.left,s.right-g.right,g.top-s.top,s.bottom-g.bottom]};
          })};
        }));
        const mm=96/25.4;
        for(const s of geometry){assert(Math.abs(s.w/mm-(paper==='a4'?210:215.9))<.05);assert(Math.abs(s.h/mm-(paper==='a4'?297:279.4))<.05);
          for(const c of s.cards){assert(Math.abs(c.w/mm-60)<.05&&Math.abs(c.h/mm-90)<.05);assert(c.inset/mm>1.99&&c.loaded&&c.fit==='contain');assert(c.margins.every(m=>m/mm>=8.9));}}
        await page.emulateMedia({media:'screen'});
      }
      await page.uncheck('#test-sheet');await page.selectOption('#sides','backs');await page.selectOption('#back-order','reverse');await ready();
      assert.deepEqual(await page.locator('#print-sheets .sheet').evaluateAll(s=>s.map(n=>Number(n.dataset.sheet))),Array.from({length:13},(_,i)=>13-i));
      await page.selectOption('#back-order','forward');
      await page.selectOption('#sides','duplex');await page.check('#test-sheet');await ready();
      await page.emulateMedia({media:'print'});
      const bytes=await page.pdf({path:path.join(output,`gothic-browser-${paper}-${flip}.pdf`),preferCSSPageSize:true,printBackground:false,displayHeaderFooter:false});
      const pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),2);
      for(const p of pdf.getPages()){assert(Math.abs(p.getWidth()/72*25.4-(paper==='a4'?210:215.9))<.3);assert(Math.abs(p.getHeight()/72*25.4-(paper==='a4'?297:279.4))<.3);}
      await page.emulateMedia({media:'screen'});
    }
    await page.uncheck('#test-sheet');await page.selectOption('#paper','letter');await ready();
    await page.locator('#next').click();assert.equal(await page.locator('#preview-canvas .sheet').getAttribute('data-side'),'back');
    await page.screenshot({path:path.join(output,'gothic-print-desktop.png'),fullPage:true});
    await page.evaluate(()=>{window.printCalls=0;window.print=()=>window.printCalls++;});await page.locator('#print-button').click();
    assert.equal(await page.evaluate(()=>window.printCalls),1);
    for(const width of [320,390,768]) {
      await page.setViewportSize({width,height:844});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Print overflow at ${width}`);
    }
    await page.goto(`${origin}/decks/gothic`);await page.locator('#printable-deck').scrollIntoViewIfNeeded();
    for(const width of [320,390,768,1360]) {
      await page.setViewportSize({width,height:844});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Gallery overflow at ${width}`);
      assert(await page.locator('#printable-deck img').evaluate(i=>i.complete&&i.naturalWidth===1000));
      await page.locator('#printable-deck').screenshot({path:path.join(output,`gothic-gallery-${width}.png`)});
    }
    const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true,
      userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36'});
    await mobile.route('https://fonts.**/*',route=>route.abort());
    const mobilePage=await mobile.newPage();await mobilePage.goto(`${origin}/decks/gothic`);
    // The entire real file is downloaded and hashed from a mobile-sized browser, not just a mocked click.
    for(const entry of manifest.files){
      const link=mobilePage.locator(`#printable-deck a[href$="/${entry.file}"]`);
      const [download]=await Promise.all([mobilePage.waitForEvent('download'),link.click()]);
      assert.equal(download.suggestedFilename(),entry.file);assert.equal(await download.failure(),null);
      assert.equal(hash(await fs.readFile(await download.path())),entry.sha256);
      await download.delete();
    }
    await mobile.close();
    // Static downloads remain usable when scripts are disabled.
    const nojs=await browser.newContext({javaScriptEnabled:false});const staticPage=await nojs.newPage();
    await staticPage.goto(`${origin}/decks/gothic`);assert.equal(await staticPage.locator('#printable-deck a[download]').count(),9);await nojs.close();
    // Legacy page must still use its own 34 faces and six-sheet layout.
    await page.goto(`${origin}/deck/print.html`);await ready();
    assert.equal(await page.locator('#print-sheets .sheet').count(),12);
    assert.equal(await page.locator('#print-sheets .sheet[data-side="front"] img').count(),34);
    assert.equal(await page.locator('#print-sheets img[src^="/cards/gothic/"]').count(),0);
    const broken=await context.newPage();await broken.route('**/cards/gothic/the-fool.webp',route=>route.fulfill({status:404,body:'Missing'}));
    await broken.goto(`${origin}/decks/gothic/print`);await broken.waitForSelector('#asset-status.error');
    assert(await broken.locator('#print-button').isDisabled());await broken.emulateMedia({media:'print'});assert.equal(await broken.locator('#print-sheets').isVisible(),false);
    await broken.close();
    const noConfig=await context.newPage();
    await noConfig.route('**/decks/gothic/print-data.js',route=>route.fulfill({status:404,body:''}));
    await noConfig.goto(`${origin}/decks/gothic/print`);await noConfig.waitForSelector('#asset-status.error');
    assert(await noConfig.locator('#print-button').isDisabled());
    assert.equal(await noConfig.locator('#print-sheets .sheet').count(),0,'Never fall back to oracle on a Gothic config failure');
    await noConfig.close();assert.deepEqual(errors,[]);
    console.log('PASS: real Chromium, all 78 DOM placements, 24 print combinations, reverse back order, CSS/PDF page sizes, previews, missing-art protection, legacy 34-card layout, 320/390/768/1360 responsive layouts and all 9 mobile-sized downloads hashed.');
  } finally {if(browser)await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
