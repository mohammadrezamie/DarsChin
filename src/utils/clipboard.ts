/**
 * Copy a manually verified course/group code in HTTPS and embedded/HTTP demos.
 * The obsolete execCommand path is an intentional compatibility fallback.
 */
export async function copyTextWithFallback(value: string): Promise<boolean> {
  if (!value) return false;

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Clipboard API may be denied on insecure origins or inside an iframe.
  }

  if (typeof document === 'undefined') return false;
  let input: HTMLTextAreaElement | null = null;
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  try {
    input = document.createElement('textarea');
    input.value = value;
    input.dir = 'ltr';
    input.readOnly = true;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    input.style.top = '0';
    document.body.appendChild(input);
    input.focus({ preventScroll: true });
    input.select();
    return typeof document.execCommand === 'function' && document.execCommand('copy');
  } catch {
    return false;
  } finally {
    input?.remove();
    previousFocus?.focus({ preventScroll: true });
  }
}
