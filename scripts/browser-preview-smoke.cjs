'use strict';
// Synthetic static UI only: no live API, accounts, SMS, or external network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..', 'dist');
const output = path.resolve(__dirname, '..', 'browser-qa-output');
const engines = ['chromium', 'firefox', 'webkit'];
const engine = process.env.DARSCHIN_BROWSER_ENGINE || 'chromium';
assert(engines.includes(engine), 'Unsupported browser');
const modulePath = process.env.DARSCHIN_BROWSER_MODULE || 'playwright';
const { [engine]: browserType } = require(modulePath);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
const prefix = '/DarsChin/';
const server = http.createServer((req,res) => {
  try {
    const pathname = new URL(req.url,'http://127.0.0.1').pathname;
    if (!pathname.startsWith(prefix)) {res.writeHead(404);res.end();return;}
    const relative = decodeURIComponent(pathname.slice(prefix.length)) || 'index.html';
    const filename = path.resolve(root,relative);
    if (!filename.startsWith(root+path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
      res.writeHead(404);res.end();return;
    }
    res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});
    fs.createReadStream(filename).pipe(res);
  } catch {res.writeHead(400);res.end();}
});
const report=[];
let browser;
async function runCase(origin,width,height) {
  const context = await browser.newContext({viewport:{width,height},colorScheme:'light',reducedMotion:'reduce',locale:'fa-IR',serviceWorkers:'block'});
  // Prevent test interaction with any actual site, even if a link or script is misconfigured.
  const external = [];
  await context.route('**/*',route=>{
    const url=route.request().url();
    if (url.startsWith(origin+'/')||url.startsWith('data:')||url.startsWith('blob:')) return route.continue();
    external.push(new URL(url).protocol);
    return route.abort();
  });
  const page = await context.newPage();
  const errors=[];
  page.on('pageerror',()=>errors.push('uncaught page error'));
  const base=origin+prefix;
  const wait = async (locator) => locator.waitFor({state:'visible',timeout:15000});
  const screenshot=async name=>page.screenshot({path:path.join(output,engine+'-'+width+'-'+name+'.png'),animations:'disabled',timeout:15000});
  const checkLayout=async name=>{
    await page.evaluate(()=>document.fonts.ready);
    const layout=await page.evaluate(()=>({lang:document.documentElement.lang,dir:document.documentElement.dir,viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    assert.equal(layout.lang,'fa',name+' language');
    assert.equal(layout.dir,'rtl',name+' direction');
    assert(layout.scroll<=layout.viewport+2,name+' horizontal overflow: '+layout.scroll+' > '+layout.viewport);
    assert.equal(errors.length,0,name+' uncaught browser error');
  };
  async function setTheme(mode) {
    const mobile=page.getByRole('combobox',{name:'انتخاب حالت نمایش'});
    if(await mobile.isVisible()) await mobile.selectOption(mode);
    else await page.getByRole('button',{name:mode==='dark'?'حالت شب':'حالت روز',exact:true}).click();
    await page.waitForFunction(mode=>document.documentElement.classList.contains('dark')===(mode==='dark'),mode);
  }
  try {
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await wait(page.getByRole('heading',{level:1}).first());
    await setTheme('light');await checkLayout('landing light');await screenshot('landing-light');
    const menu=page.getByRole('button',{name:'بازکردن منوی اصلی'});
    if(await menu.isVisible()) {
      await menu.click();
      const dialog=page.getByRole('dialog',{name:'منوی اصلی صفحه'});
      await wait(dialog);await page.keyboard.press('Escape');
      await dialog.waitFor({state:'hidden'});
      assert(await menu.evaluate(el=>el===document.activeElement),'Mobile menu did not return focus');
    }
    await setTheme('dark');await checkLayout('landing dark');await screenshot('landing-dark');
    await page.reload({waitUntil:'domcontentloaded'});
    await wait(page.getByRole('heading',{level:1}).first());
    assert(await page.locator('html').evaluate(el=>el.classList.contains('dark')),'Theme did not persist');
    await page.getByRole('link',{name:'دیدن نمونهٔ پنل دانشجو',exact:true}).click();
    await wait(page.getByLabel('ابزارهای دموی درس‌چین'));
    await checkLayout('student demo');await screenshot('student-demo');
    await page.getByRole('button',{name:'بازنشانی دمو'}).click();
    const confirm=page.getByRole('alertdialog',{name:'تأیید بازنشانی'});
    await wait(confirm);await confirm.getByRole('button',{name:'انصراف'}).click();await confirm.waitFor({state:'hidden'});
    await page.goto(base+'#/demo/admin');await wait(page.getByLabel('ابزارهای دموی درس‌چین'));
    await checkLayout('admin demo');await screenshot('admin-demo');
    await page.goto(base+'#/login');await wait(page.getByRole('heading',{name:'ورود به حساب کاربری'}));
    await checkLayout('login');await screenshot('login');
    for(const route of ['register','forgot-password']){
      await page.goto(base+'#/'+route);await wait(page.getByRole('heading',{level:2}).first());
      await checkLayout(route);await screenshot(route);
    }
    assert.equal(errors.length,0,'Uncaught page error during synthetic navigation');
    assert.equal(external.length,0,'Unexpected external browser requests');
    report.push({engine,width,height,ok:true});
  } catch(error) {
    report.push({engine,width,height,ok:false,reason:String(error.message).split('\n')[0]});
    await screenshot('failure').catch(()=>{});
  } finally {await context.close();}
}
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  assert(fs.existsSync(path.join(root,'index.html')),'Build static preview first');
  try {
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    browser=await browserType.launch({headless:true});
    const origin='http://127.0.0.1:'+server.address().port;
    for(const [width,height] of [[320,720],[390,844],[768,1024],[1440,900]]) await runCase(origin,width,height);
    console.log(JSON.stringify(report,null,2));
    if(report.some(x=>!x.ok))process.exitCode=1;
  } finally {
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
    fs.writeFileSync(path.join(output,engine+'-report.json'),JSON.stringify(report,null,2)+'\n');
  }
})().catch(()=>{console.error('Browser smoke setup failed');process.exitCode=1;});
