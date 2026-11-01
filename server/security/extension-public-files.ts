import fs from 'node:fs';
import path from 'node:path';
import allowlistedAssets from '../../extension/public-files.json';

/**
 * One shared list for browser downloads and the release ZIP script.
 * Never package arbitrary runtime files, symlinks, .env or an entire folder.
 */
export function publicExtensionAssets(directory: string): Array<{ absolutePath: string; archiveName: string }> {
  const base = path.resolve(directory);
  const seen = new Set<string>();
  return allowlistedAssets.map(archiveName => {
    if (typeof archiveName !== 'string' || !/^[A-Za-z0-9_./-]+$/.test(archiveName) ||
        archiveName.startsWith('/') || archiveName.split('/').some(part => part === '.' || part === '..' || !part) ||
        /(^|\/)\.env(?:$|\.)/i.test(archiveName) ||
        seen.has(archiveName)) {
      throw new Error('Invalid public extension archive manifest');
    }
    seen.add(archiveName);
    const absolutePath = path.resolve(base, archiveName);
    if (!absolutePath.startsWith(base + path.sep)) throw new Error('Invalid extension file path');
    const info = fs.lstatSync(absolutePath);
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new Error('A public extension asset must be an ordinary regular file');
    }
    return { absolutePath, archiveName };
  });
}
