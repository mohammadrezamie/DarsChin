import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { blockPrivateBuildArtifacts, isForbiddenPublicBuildPath } from '../server/middleware/public-static';

describe('production static assets must not expose private server build', () => {
  it('rejects backend bundle, sourcemaps, env and malformed/encoded paths', () => {
    for (const name of [
      '/server.cjs', '/SERVER.CJS', '/server.cjs.map', '/assets/client.js.map',
      '/.env', '/deploy/.env.vps', '/service-account.json',
      '/%73erver.cjs', '/assets/../server.cjs', '/private\\server.cjs',
      '/%ZZ',
    ]) {
      expect(isForbiddenPublicBuildPath(name), name).toBe(true);
    }
    for (const name of ['/index.html','/assets/index-123.js','/assets/index.css','/manifest.webmanifest']) {
      expect(isForbiddenPublicBuildPath(name), name).toBe(false);
    }
  });

  it('blocks private build artifacts over HTTP while serving public client assets', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'darschin-private-build-'));
    try {
      mkdirSync(join(directory, 'assets'));
      writeFileSync(join(directory, 'server.cjs'), 'SYNTHETIC_SERVER_PRIVATE_MARKER');
      writeFileSync(join(directory, 'server.cjs.map'), 'SYNTHETIC_PRIVATE_SOURCEMAP_MARKER');
      writeFileSync(join(directory, 'index.html'), '<p>Synthetic public home</p>');
      writeFileSync(join(directory, 'assets', 'app.js'), '/* synthetic public asset */');
      const app = express();
      app.use(blockPrivateBuildArtifacts);
      app.use(express.static(directory));
      app.get('*', (_req, res) => res.sendFile(join(directory, 'index.html')));
      for (const p of ['/server.cjs', '/server.cjs.map', '/%73erver.cjs']) {
        const response = await request(app).get(p);
        expect(response.status).toBe(404);
        expect(response.text).not.toContain('SYNTHETIC_SERVER_PRIVATE_MARKER');
        expect(response.text).not.toContain('SYNTHETIC_PRIVATE_SOURCEMAP_MARKER');
      }
      expect((await request(app).get('/assets/app.js')).status).toBe(200);
      expect((await request(app).get('/index.html')).status).toBe(200);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('mounts the guard before express.static in the actual production entrypoint', () => {
    const src = readFileSync(resolve(process.cwd(), 'server.ts'), 'utf8');
    const guard = src.indexOf('app.use(blockPrivateBuildArtifacts);');
    const staticServer = src.indexOf('app.use(express.static(distPath');
    expect(guard).toBeGreaterThan(0);
    expect(staticServer).toBeGreaterThan(guard);
  });
});
