import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname ?? '.', '..');
const load = (name: string) => fs.readFileSync(path.join(root, name), 'utf8');

describe('one-repository deploy safety contract', () => {
  it('forwards existing DB and OTP safety environment flags into the container', () => {
    const compose = load('compose.yaml');
    expect(compose).toContain('DARSCHYN_REQUIRE_EXISTING_DB: ${DARSCHYN_REQUIRE_EXISTING_DB:-false}');
    expect(compose).toContain('DARSCHYN_REGISTRATION_OTP_REQUIRED: ${DARSCHYN_REGISTRATION_OTP_REQUIRED:-false}');
    expect(compose).toContain('DARSCHYN_ACCESS_MODE: ${DARSCHYN_ACCESS_MODE:-multiuser}');
    expect(compose).toContain('darschin-data:/app/data');
  });
  it('keeps private server configuration and data out of Docker build context', () => {
    const ignored = load('.dockerignore');
    expect(ignored).toMatch(/(^|\n)data(\n|$)/);
    expect(ignored).toMatch(/(^|\n)\.env(\n|$)/);
    expect(ignored).toContain('**/.env.*');
    expect(load('Dockerfile')).toContain('USER node');
  });
  it('documents dedicated and shared VPS installation without forcing Caddy on shared Nginx', () => {
    const guide = load('docs/SELF_HOSTING_OPEN_SOURCE_FA.md');
    expect(guide).toContain('git pull --ff-only origin main');
    expect(guide).toContain('compose.pilot-ssh.yaml');
    expect(guide).toContain('DARSCHYN_ACCESS_MODE=owner_only');
    expect(guide).toContain('docker compose down -v');
  });
});
