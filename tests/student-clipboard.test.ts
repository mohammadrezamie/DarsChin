import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { copyTextWithFallback } from '../src/utils/clipboard';

afterEach(() => vi.unstubAllGlobals());

describe('safe student code copying', () => {
  it('copies a real code with the permitted modern Clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    vi.stubGlobal('document', undefined);
    expect(await copyTextWithFallback('410019')).toBe(true);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith('410019');
  });

  it('falls back after clipboard denial, removes the temporary field and restores focus', async () => {
    class Focusable { focus = vi.fn(); }
    const focused = new Focusable();
    const textarea = {
      value: '', dir: '', readOnly: false, style: {} as Record<string, string>,
      focus: vi.fn(), select: vi.fn(), remove: vi.fn(),
    };
    const appendChild = vi.fn();
    const execCommand = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    vi.stubGlobal('HTMLElement', Focusable);
    vi.stubGlobal('document', {
      activeElement: focused, body: { appendChild },
      createElement: vi.fn().mockReturnValue(textarea), execCommand,
    });

    expect(await copyTextWithFallback('410019')).toBe(true);
    expect(textarea.value).toBe('410019');
    expect(textarea.readOnly).toBe(true);
    expect(textarea.dir).toBe('ltr');
    expect(appendChild).toHaveBeenCalledTimes(1);
    expect(textarea.select).toHaveBeenCalledTimes(1);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(textarea.remove).toHaveBeenCalledTimes(1);
    expect(focused.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('never reports success on a failed fallback and does not leak temporary DOM', async () => {
    const textarea = {
      value: '', dir: '', readOnly: false, style: {} as Record<string, string>,
      focus: vi.fn(), select: vi.fn(), remove: vi.fn(),
    };
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('HTMLElement', class Focusable {});
    vi.stubGlobal('document', {
      activeElement: null, body: { appendChild: vi.fn() },
      createElement: vi.fn().mockReturnValue(textarea),
      execCommand: vi.fn().mockImplementation(() => { throw new Error('blocked'); }),
    });
    expect(await copyTextWithFallback('410019')).toBe(false);
    expect(textarea.remove).toHaveBeenCalledTimes(1);
    expect(await copyTextWithFallback('')).toBe(false);
  });

  it('makes the planner distinguish imported offering codes from unverified catalog samples', () => {
    const planner = readFileSync(resolve(process.cwd(), 'src/components/SchedulePlanner.tsx'), 'utf8');
    expect(planner).toContain("import { copyTextWithFallback } from '../utils/clipboard'");
    expect(planner).toContain("const importedCode = primary?.rawCourseCode?.trim() || '';");
    expect(planner).toContain("!/^DEMO[-_]/i.test(copyCode)");
    expect(planner).toContain("disabled={!canCopyCode}");
    expect(planner).toContain('کد کاتالوگ؛ تأییدنشده');
    expect(planner).toContain('کپی نشد؛ دستی بردار');
    expect(planner).not.toContain('navigator.clipboard.writeText(code)');
    expect(planner).not.toContain('primary?.courseCode || primary?.courseCode');
  });
});
