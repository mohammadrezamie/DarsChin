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
    // Interactive curriculum QA: same real UI, synthetic mock only, independent cohorts.
    const adminChartUrl=base+'#/demo/admin';
    const editorName='ویرایش برنامهٔ پیشنهادی مستقل';
    const chartSelector='چارت‌های فعال و پیش‌نویس:';
    const saveLabel='ذخیرهٔ برنامهٔ پیشنهادی';
    const createLabel='ایجاد برنامهٔ پیشنهادی';
    const openCurriculumTab=async p=>{
      if(width<1024){
        await p.getByRole('button',{name:'بازکردن فهرست بخش‌های مدیریت',exact:true}).click();
        const drawer=p.getByRole('dialog',{name:'فهرست بخش‌های مدیریت'});
        await wait(drawer);
        await drawer.getByRole('button',{name:'چارت‌های تحصیلی',exact:true}).click();
        await drawer.waitFor({state:'hidden'});
      } else {
        const nav=p.locator('aside[aria-label="ناوبری دسکتاپ مدیریت"]');
        await nav.getByRole('button',{name:'چارت‌های تحصیلی',exact:true}).click();
      }
      await wait(p.getByRole('heading',{name:'مدیریت ساختار چارت تحصیلی'}));
    };
    const scope=async p=>{
      await p.goto(adminChartUrl);
      await wait(p.getByLabel('ابزارهای دموی درس‌چین'));
      await openCurriculumTab(p);
      const selector=p.getByLabel(chartSelector,{exact:true});
      await wait(selector);
      await selector.locator('option[value="demo-curriculum"]').waitFor({state:'attached',timeout:15000});
      await selector.selectOption('demo-curriculum');
      const editor=p.getByRole('region',{name:editorName});
      await wait(editor);
      await wait(editor.getByRole('button',{name:'دریافت آخرین نسخه',exact:true}));
      return {editor,selector};
    };
    const {editor,selector}=await scope(page);
    await editor.getByRole('button',{name:createLabel,exact:true}).click();
    await editor.getByLabel('عنوان دوره',{exact:true}).fill('دورهٔ آزمایشی اول');
    await editor.getByRole('button',{name:'افزودن دوره',exact:true}).click();
    await editor.getByLabel('عنوان دوره',{exact:true}).fill('تابستان آزمایشی');
    await editor.getByLabel('نوع دوره',{exact:true}).selectOption('summer');
    await editor.getByRole('button',{name:'افزودن دوره',exact:true}).click();
    const course=editor.getByLabel('درس پیشنهادی',{exact:true});
    await course.selectOption('math2');
    assert.equal(await course.locator('option[value="em"]').count(),0,'Foreign track course visible in common scope');
    await editor.getByRole('button',{name:'افزودن درس به برنامه',exact:true}).click();
    const summer=editor.locator('article').filter({has:editor.getByLabel('عنوان دورهٔ 2',{exact:true})});
    await wait(summer.getByRole('button',{name:'حذف از برنامه',exact:true}));
    await summer.getByRole('button',{name:'حذف دوره',exact:true}).click();
    await wait(editor.getByRole('alert').filter({hasText:'ابتدا درس‌های این دوره'}));
    // Attempt chart switch, cancel, and verify the local draft was not lost.
    let rejectedSwitch=false;
    page.once('dialog',async dialog=>{rejectedSwitch=dialog.type()==='confirm';await dialog.dismiss();});
    await selector.selectOption('demo-curriculum-1402');
    assert(rejectedSwitch,'No confirmation for unsaved chart switch');
    assert.equal(await selector.inputValue(),'demo-curriculum');
    await wait(editor.getByRole('status').filter({hasText:'تغییرات ذخیره‌نشده'}));
    await editor.getByRole('button',{name:saveLabel,exact:true}).click();
    await wait(editor.getByRole('status').filter({hasText:'برنامهٔ پیشنهادی ذخیره شد'}));
    await checkLayout('study plan editor dark');await screenshot('study-plan-dark');
    // Reopening this chart must retain the saved plan; another cohort is absent.
    await selector.selectOption('demo-curriculum-1402');
    await wait(editor.getByRole('button',{name:createLabel,exact:true}));
    await selector.selectOption('demo-curriculum');
    await wait(editor.getByLabel('عنوان دورهٔ 2',{exact:true}));
    assert.equal(await editor.getByLabel('عنوان دورهٔ 2',{exact:true}).inputValue(),'تابستان آزمایشی');
    await editor.getByLabel('دامنهٔ برنامهٔ پیشنهادی',{exact:true}).selectOption('demo-power');
    await wait(editor.getByRole('button',{name:createLabel,exact:true}));
    await editor.getByLabel('دامنهٔ برنامهٔ پیشنهادی',{exact:true}).selectOption('');
    await wait(editor.getByLabel('عنوان دورهٔ 2',{exact:true}));
    // A sequential stale write from a second browser tab must not overwrite
    // a newer save. This is demo localStorage behavior, not a database lock.
    const second=await context.newPage();
    second.on('pageerror',()=>errors.push('uncaught second-tab page error'));
    try {
      const {editor:other}=await scope(second);
      await wait(other.getByLabel('عنوان دورهٔ 2',{exact:true}));
      await other.getByLabel('عنوان دورهٔ 2',{exact:true}).fill('نسخهٔ تازهٔ مدیر دوم');
      await other.getByRole('button',{name:saveLabel,exact:true}).click();
      await wait(other.getByRole('status').filter({hasText:'برنامهٔ پیشنهادی ذخیره شد'}));
      await editor.getByLabel('عنوان دورهٔ 2',{exact:true}).fill('تغییر قدیمی مدیر اول');
      await editor.getByRole('button',{name:saveLabel,exact:true}).click();
      await wait(editor.getByRole('alert').filter({hasText:'برنامه توسط مدیر دیگری تغییر کرده است'}));
      assert.equal(await editor.getByLabel('عنوان دورهٔ 2',{exact:true}).inputValue(),'تغییر قدیمی مدیر اول');
      page.once('dialog',dialog=>dialog.accept());
      await editor.getByRole('button',{name:'دریافت آخرین نسخه',exact:true}).click();
      await wait(editor.getByLabel('عنوان دورهٔ 2',{exact:true}));
      assert.equal(await editor.getByLabel('عنوان دورهٔ 2',{exact:true}).inputValue(),'نسخهٔ تازهٔ مدیر دوم');
    } finally {await second.close();}
    // Save was verified; reload without local dirty edits and verify persistence.
    await page.reload({waitUntil:'domcontentloaded'});
    const current=await scope(page);
    await wait(current.editor.getByLabel('عنوان دورهٔ 2',{exact:true}));
    assert.equal(await current.editor.getByLabel('عنوان دورهٔ 2',{exact:true}).inputValue(),'نسخهٔ تازهٔ مدیر دوم');
    page.once('dialog',dialog=>dialog.accept());
    await current.editor.getByRole('button',{name:'حذف برنامهٔ ذخیره‌شده',exact:true}).click();
    await wait(current.editor.getByRole('button',{name:createLabel,exact:true}));
    await checkLayout('study plan removed');await screenshot('study-plan-removed');
    await page.goto(base+'#/login');await wait(page.getByRole('heading',{name:'ورود به حساب کاربری'}));
    await checkLayout('login');await screenshot('login');
    await page.locator('input[type=tel]').fill('۰۹۹۹۹۹۹۹۹۹۹');
    await page.getByRole('button',{name:'ادامه به رمز عبور و کد امنیتی'}).click();
    await wait(page.getByRole('alert').filter({hasText:'سرویس صدور کد امنیتی در دسترس نیست'}));
    assert(await page.getByRole('button',{name:'ورود',exact:true}).isDisabled(),'Login accepted without challenge');
    await checkLayout('login offline challenge');await screenshot('login-offline');
    for(const route of ['register','forgot-password']){
      await page.goto(base+'#/'+route);await wait(page.getByRole('heading',{level:2}).first());
      await wait(page.getByRole('alert').filter({hasText:'سرویس صدور کد امنیتی در دسترس نیست'}));
      const submit=page.getByRole('button',{name:route==='register'?'ثبت‌نام':'دریافت کد تایید',exact:true});
      assert(await submit.isDisabled(),'Offline guest form accepts missing challenge');
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
