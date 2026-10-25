import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('RTL mobile navigation and accessible theme modes', () => {
  it('positions the homepage hamburger and its drawer at the RTL right edge', () => {
    const landing = source('src/pages/Landing.tsx');
    expect(landing).toContain('dir="rtl"');
    expect(landing).toContain('aria-label="بازکردن منوی اصلی"');
    expect(landing).toContain('aria-controls="landing-mobile-navigation"');
    expect(landing).toContain('absolute inset-y-0 right-0');
    expect(landing).toContain('href={item.href} onClick={closeMenu}');
    expect(landing).toContain('<ThemeToggle />');
    expect(landing).toContain("event.key === 'Escape'");
  });

  it('puts the dashboard mobile trigger before the brand, with a right-side drawer', () => {
    const navbar = source('src/components/Navbar.tsx');
    const menuPosition = navbar.indexOf('aria-label="بازکردن منوی اصلی"');
    const brandPosition = navbar.indexOf("to={user ? '/dashboard' : '/'}");
    expect(menuPosition).toBeGreaterThan(-1);
    expect(brandPosition).toBeGreaterThan(menuPosition);
    expect(navbar).toContain('absolute inset-y-0 right-0');
    expect(navbar).toContain('aria-controls="mobile-main-navigation"');
    expect(navbar).toContain("event.key === 'Escape'");
    expect(navbar).toContain('<ThemeToggle />');
    expect(navbar).toContain('canManage &&');
  });

  it('uses a right-side drawer for admin sections instead of mobile tab overflow', () => {
    const admin = source('src/components/AdminDashboard.tsx');
    expect(admin).toContain('aria-controls="admin-mobile-navigation"');
    expect(admin).toContain('absolute inset-y-0 right-0');
    expect(admin).toContain('darschin-admin-panel hidden');
    expect(admin).toContain('setMobileMenuOpen(false)');
    expect(admin).toContain("event.key === 'Escape'");
  });

  it('shows a usable day / automatic / night switch on mobile and desktop', () => {
    const toggle = source('src/components/ThemeToggle.tsx');
    expect(toggle).toContain("mode: 'light', label: 'روز'");
    expect(toggle).toContain("mode: 'system', label: 'خودکار'");
    expect(toggle).toContain("mode: 'dark', label: 'شب'");
    expect(toggle).toContain('aria-label="انتخاب حالت نمایش"');
    expect(toggle).toContain('sm:hidden');
    expect(toggle).toContain('aria-pressed={theme === option.mode}');
    expect(toggle).toContain('min-h-11');
  });
});
