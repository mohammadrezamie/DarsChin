import type { RequestHandler } from 'express';
import path from 'node:path';

/**
 * The production server is bundled inside dist/server.cjs, which also contains
 * Vite's public client build. Never let express.static expose the server bundle,
 * source maps or runtime configuration just because the files share a folder.
 */
export function isForbiddenPublicBuildPath(requestPath: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(requestPath).replace(/\\/g, '/');
  } catch {
    return true; // Malformed encoded path must not fall through to a static server.
  }
  if (decoded.includes('\0')) return true;
  // Normalize dot-segments and duplicate separators before checking the path.
  const normalized = path.posix.normalize('/' + decoded);
  const name = path.posix.basename(normalized).toLowerCase();
  return name === 'server.cjs' || name === 'server.js' ||
    name.endsWith('.map') || name === '.env' || name.startsWith('.env.') ||
    /^(?:credentials|secrets|service-account)(?:\.json)?$/.test(name);
}

export const blockPrivateBuildArtifacts: RequestHandler = (req, res, next) => {
  if (isForbiddenPublicBuildPath(req.path)) {
    res.status(404).end();
    return;
  }
  next();
};
