/* Read-only production browser check. No forms, APIs, email or analytics. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),base=(process.argv[2]||'https://www.thecatpriestess.com').replace(/\/$/,'');
async function main(){
  const manifest=JSON.parse(await fs.readFile(path.join(root,'decks/gothic/downloads/manifest.json')));
  const server=process.env.HTTPS_PROXY||process.env.HTTP_PROXY;let proxy;
  if(server){const u=new URL(server);proxy={server:`${u.protocol}//${u.host}`,username:decodeURIComponent(u.username),password:decodeURIComponent(u.password)};}
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,proxy,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true,
      userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36'});
    await context.addInitScript(()=>localStorage.setItem('cp-consent','denied'));
    await context.route(/https:\/\/(fonts\.|www\.googletagmanager\.)/,r=>r.abort());
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/decks/gothic`,{waitUntil:'domcontentloaded',timeout:120000});
    assert.equal(await page.locator('#printable-deck a[download]').count(),9);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.locator('#printable-deck img').waitFor();
    await page.waitForFunction(()=>document.querySelector('#printable-deck img').naturalWidth===1000);
    for(const entry of manifest.files){
      const link=page.locator(`#printable-deck a[href$="/${entry.file}"]`);
      assert.equal(await link.getAttribute('download'),'');
      assert.equal(new URL(await link.getAttribute('href'),base).origin,new URL(base).origin);
    }
    for(const name of ['nocturne-cathedral-letter-long-edge.pdf','nocturne-cathedral-a4-short-edge-calibration.pdf','nocturne-cathedral-printing-guide.pdf']){
      const [download]=await Promise.all([page.waitForEvent('download',{timeout:120000}),page.locator(`#printable-deck a[href$="/${name}"]`).click()]);
      assert.equal(await download.failure(),null);assert.equal(download.suggestedFilename(),name);
      const bytes=await fs.readFile(await download.path());
      assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),manifest.files.find(f=>f.file===name).sha256);await download.delete();
    }
    await page.goto(`${base}/decks/gothic/print`,{waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:120000});
    assert.equal(await page.locator('#print-sheets .sheet').count(),26);
    assert.equal(await page.locator('#print-sheets [data-side="front"] img').count(),78);
    assert.equal(await page.locator('#print-button').isEnabled(),true);
    await page.selectOption('#paper','a4');await page.selectOption('#flip','short');
    await page.waitForFunction(()=>document.body.dataset.ready==='true');
    assert.equal(await page.locator('#print-sheets .sheet').count(),26);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.locator('#next').click();assert.equal(await page.locator('#preview-canvas .sheet').getAttribute('data-side'),'back');
    await page.goto(`${base}/deck/print.html`,{waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:120000});
    assert.equal(await page.locator('#print-sheets .sheet').count(),12);
    assert.deepEqual(errors,[]);
    console.log('PASS: production Chromium with Android emulation; new gallery preview and all 9 direct links; full-deck/calibration/guide downloads match release hashes; 78-card workspace, A4/short-edge controls and original 34-card workspace ready; no browser errors.');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
