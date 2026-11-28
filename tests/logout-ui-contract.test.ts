import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
describe('رابط خروج امن',()=>{
  it('شروع ابطال سروری پیش از پاک کردن توکن و نمایش شکست',()=>{
    const auth=readFileSync('src/context/AuthContext.tsx','utf8');
    const logout=auth.slice(auth.indexOf('  const logout ='),auth.indexOf('  const switchDemoRole ='));
    expect(logout.indexOf("apiRequest('/api/auth/logout', { method: 'POST' })")).toBeGreaterThan(-1);
    expect(logout.indexOf("apiRequest('/api/auth/logout'")).toBeLessThan(logout.indexOf('setStoredToken(null)'));
    expect(logout).toContain('authEpoch.current !== epoch');
    expect(logout).toContain('ابطال نشست‌های قبلی در سرور تأیید نشد');
    expect(readFileSync('src/pages/auth/Login.tsx','utf8')).toContain('{logoutNotice && <p role="status"');
  });
});
