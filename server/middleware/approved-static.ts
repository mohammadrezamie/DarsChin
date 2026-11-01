import fs from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from 'express';
import allowedExtensionAssets from '../../extension/public-files.json';

/**
 * Static files are public HTTP resources. Only ship files approved by the
 * maintained source manifest, never arbitrary folders on a production VPS.
 *
 * Check real paths for every request: a newly added file, a symlinked directory
 * or a replaced asset cannot bypass the whitelist between deployments.
 */
export function approvedStaticGate(root: string, approved: readonly string[]): RequestHandler {
  const names = new Set(approved);
  const base = path.resolve(root);
  return (req, res, next) => {
    const requested = req.path.replace(/^\/+/, '') || 'index.html';
    if (!names.has(requested)) {
      res.status(404).end();
      return;
    }
    try {
      const target = path.resolve(base, requested);
      if (!target.startsWith(base + path.sep)) {
        res.status(404).end();
        return;
      }
      const stat = fs.lstatSync(target);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        res.status(404).end();
        return;
      }
      const rootReal = fs.realpathSync(base);
      const targetReal = fs.realpathSync(target);
      if (!targetReal.startsWith(rootReal + path.sep)) {
        res.status(404).end();
        return;
      }
      res.setHeader('X-Content-Type-Options', 'nosniff');
      next();
    } catch {
      // Unavailable, broken or symlinked assets fail closed without a path leak.
      res.status(404).end();
    }
  };
}

export function approvedExtensionStaticGate(root: string): RequestHandler {
  return approvedStaticGate(root, allowedExtensionAssets);
}

/** The public mock portal is a single approved demonstration page only. */
export function approvedMockPortalStaticGate(root: string): RequestHandler {
  return approvedStaticGate(root, ['index.html']);
}
