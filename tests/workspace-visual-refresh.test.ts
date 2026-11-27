import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';
const read=(file:string)=>readFileSync(resolve(process.cwd(),file),'utf8');
const css=read('src/workspace-design.css');
function color(block:string,key:string){
  const value=block.match(new RegExp('--ws-'+key+':\\s*(#[0-9a-f]{6})','i'))?.[1];
  if(!value)throw Error('توکن رنگ یافت نشد: '+key);
  return value;
}
function luminance(hex:string){
  const values=hex.slice(1).match(/../g)!.map(x=>parseInt(x,16)/255)
    .map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
  return values[0]*.2126+values[1]*.7152+values[2]*.0722;
}
function contrast(a:string,b:string){
  const [x,y]=[luminance(a),luminance(b)].sort((a,b)=>b-a);
  return (x+.05)/(y+.05);
}
describe('هویت بصری پنل‌های محصول',()=>{
  it('کنتراست توکن‌های متن و دکمه در تم روز و شب را کنترل می‌کند',()=>{
    const blocks=css.split('.dark :is(.dc-product-shell,.dc-product-workspace,.dc-product-auth)');
    expect(blocks).toHaveLength(2);
    for(const block of blocks){
      for(const surface of ['paper','canvas','soft']){
        for(const text of ['ink','muted','brand']){
          expect(contrast(color(block,text),color(block,surface)),text+' / '+surface).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(contrast(color(block,'brand'),color(block,'on-brand'))).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('فقط محصول و مسیرهای احراز هویت به پوستهٔ تازه متصل‌اند',()=>{
    expect(read('src/index.css')).toContain('@import "./workspace-design.css";');
    for(const file of ['src/App.tsx','src/pages/DemoWorkspace.tsx'])expect(read(file)).toContain('dc-product-shell');
    for(const file of ['AdminDashboard','StudentDashboard','DemandWorkspace'])expect(read('src/components/'+file+'.tsx')).toContain('dc-product-workspace');
    expect(read('src/pages/Landing.tsx')).not.toContain('dc-product-shell');
    expect(read('src/pages/Landing.tsx')).not.toContain('dc-product-workspace');
  });
  it('سه فرم احراز هویت در ساختار مشترک و بدون حذف کنترل امنیتی باقی می‌مانند',()=>{
    for(const page of ['Login','Register','ForgotPassword']){
      const source=read('src/pages/auth/'+page+'.tsx');
      for(const marker of ['dc-product-auth','dc-auth-layout','dc-auth-intro','dc-auth-card','GuestHumanCheck'])
        expect(source).toContain(marker);
    }
    const login=read('src/pages/auth/Login.tsx');
    expect(login.indexOf('className="dc-auth-card"')).toBeLessThan(login.indexOf('className="dc-auth-demo"'));
    expect(login).toContain('to="/demo/student"');
    expect(login).toContain('to="/demo/admin"');
  });
  it('ناوبری و دسترس‌پذیری، تم و موبایل حفظ شده‌اند',()=>{
    expect(css).toContain('aria-current="page"');
    expect(css).toContain('@media (min-width:900px)');
    expect(css).toContain('@media (max-width:639px)');
    expect(css).toContain('@media (prefers-reduced-motion:reduce)');
    expect(css).toContain('@media (forced-colors:active)');
    expect(css).toContain('@media print');
    const dock=read('src/components/StudentMobileDock.tsx');
    expect(dock).toContain('dc-workspace-navigation dc-student-dock');
    expect(dock).toContain('env(safe-area-inset-bottom');
    expect(dock).toContain('aria-modal="true"');
    for(const file of ['StudentDashboard','AdminDashboard'])
      expect(read('src/components/'+file+'.tsx')).toContain('dc-workspace-section-heading');
  });
});
