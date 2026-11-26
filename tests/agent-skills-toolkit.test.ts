import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const folder = resolve(root, '.agents/skills');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const required = [
  'darschin-visual-design', 'darschin-mobile-accessibility', 'darschin-browser-qa',
  'darschin-security-review', 'darschin-quality-gate',
  'font-loading-and-performance', 'international-typography',
];

describe('مهارت‌های توسعهٔ درس‌چین', () => {
  it('مهارت‌های منتخب فرادادهٔ یکتا و متن فارسی دارند', () => {
    const dirs = readdirSync(folder, { withFileTypes: true }).filter(e => e.isDirectory());
    const names = dirs.map(e => e.name);
    for (const name of required) expect(names).toContain(name);
    for (const name of required) {
      const text = read('.agents/skills/' + name + '/SKILL.md');
      expect(text.startsWith('---\nname: ' + name + '\n')).toBe(true);
      expect(text).toMatch(/\ndescription: .+\n---/);
      expect(text).toMatch(/[\u0600-\u06ff]{3,}/);
    }
  });
  it('مهارت‌های منتقل‌شده مرجع و مجوز MIT دارند', () => {
    for (const name of ['font-loading-and-performance', 'international-typography']) {
      const path = '.agents/skills/' + name + '/';
      expect(read(path + 'LICENSE')).toContain('MIT License');
      expect(read(path + 'UPSTREAM.md')).toContain('name: ' + name);
      expect(read(path + 'SKILL.md')).toContain('UPSTREAM.md');
    }
    expect(read('AGENTS.md')).toContain('AGENT_SKILLS_TOOLKIT_FA.md');
    expect(read('docs/INDEX.md')).toContain('AGENT_SKILLS_TOOLKIT_FA.md');
  });
});
