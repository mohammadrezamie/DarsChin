import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const config = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'));

describe('Vercel SPA routing', () => {
  it('supports direct navigation and refresh of all public and protected React Router pages', () => {
    const rewrites: { source: string; destination: string }[] = config.rewrites;
    for (const source of ['/login', '/register', '/forgot-password', '/dashboard', '/admin']) {
      expect(rewrites).toContainEqual({ source, destination: '/index.html' });
    }
  });

  it('leaves /api routes for Vercel Functions instead of serving index.html', () => {
    const rewrites: { source: string; destination: string }[] = config.rewrites;
    expect(rewrites.every(({ source }) => source.startsWith('/') && !source.startsWith('/api'))).toBe(true);
    expect(rewrites.every(({ destination }) => destination === '/index.html')).toBe(true);
  });
});
