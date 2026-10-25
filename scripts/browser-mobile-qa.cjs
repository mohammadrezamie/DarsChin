#!/usr/bin/env node
// Browser smoke for locally built landing page. No production or remote services.
// Optional local dependency: playwright + installed Chromium. Never downloads in CI automatically.
const { spawn } = require('node:child_process');
const net=require('node:net');
const path=require('node:path');
const fs=require('node:fs');
const root=path.resolve(__dirname,'..');
if(process.env.NODE_ENV==='production' || process.env.DARSCHYN_PRODUCTION==='true'){
  console.error('Refusing browser QA in production.');process.exit(2);
}
let chromium;
try {({chromium}=require('playwright'));}catch{
  console.error('Missing local Playwright; install in disposable developer environment, then run --browser again.');
  console.error('Example: npm install --no-save --package-lock=false playwright && npx playwright install chromium');
  process.exit(2);
}
if(!fs.existsSync(path.join(root,'dist','index.html'))){
  console.error('Build missing: first run node scripts/local-gate.cjs --full.');
  process.exit(2);
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function freePort(){
  const server=net.createServer();
  await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  await new Promise(resolve=>server.close(resolve));return port;
}
async function main(){
  const port=await freePort();
  const url='http://127.0.0.1:'+port;
  const child=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),
    'preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{
    cwd:root,env:{...process.env,NODE_ENV:'test'},stdio:'ignore',
  });
  let browser;
  try{
    let ready=false;
    for(let i=0;i<40;i++){
      if(child.exitCode!==null)throw Error('Vite preview exited');
      try{const res=await fetch(url,{signal:AbortSignal.timeout(500)});if(res.ok){ready=true;break;}}catch{}
      await sleep(150);
    }
    if(!ready)throw Error('Could not open localhost preview');
    browser=await chromium.launch({headless:true});
    for(const width of [320,390,430,768,1024,1280]){
      const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
      await page.goto(url,{waitUntil:'networkidle'});
      const section=page.locator('#schedule');
      await section.scrollIntoViewIfNeeded();
      const result=await page.evaluate(()=>{
        const container=document.querySelector('#schedule');
        const nav=document.querySelector('html');
        const cards=container?.querySelector('[aria-label="برنامهٔ هفتگی نمونه به تفکیک روز"]');
        const grid=container?.querySelector('[aria-label="جدول هفتگی نمونه"]');
        const visible=(node)=>!!node && getComputedStyle(node).display!=='none';
        return {
          pageWidth:nav.scrollWidth,windowWidth:window.innerWidth,
          sectionWidth:container?.getBoundingClientRect().width,
          cardsVisible:visible(cards),gridVisible:visible(grid),
          namesVisible:!!container?.textContent?.includes('دکتر احمدی'),
          cardOverflow:[...container.querySelectorAll('article')].filter(el=>{
            const r=el.getBoundingClientRect();
            return r.width>0 && (r.right>window.innerWidth+1 || r.left< -1);
          }).length,
        };
      });
      const mobile=width<1024;
      if(result.pageWidth>width+1 || result.cardOverflow!==0 ||
        result.cardsVisible!==mobile || result.gridVisible===mobile || !result.namesVisible)
        throw Error('Responsive schedule failure at '+width+': '+JSON.stringify(result));
      console.log('PASS: landing viewport '+width+'px, schedule mode='+ (mobile?'cards':'grid'));
      await page.close();
    }
  }finally{
    if(browser)await browser.close();
    child.kill('SIGTERM');
  }
}
main().then(()=>console.log('Chromium landing mobile QA passed.')).catch(e=>{
 console.error(e.stack||e.message);process.exitCode=1;
});
