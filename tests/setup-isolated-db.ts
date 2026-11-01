import { afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Every test file gets its own disposable database directory. Vitest runs
// multiple worker processes in parallel; sharing one JSON path causes races
// between atomic .tmp -> .json renames and contaminates fixtures across suites.
// This setup file is loaded before the suite imports server/db/database.ts.
const isolatedData = mkdtempSync(join(tmpdir(), 'darschin-vitest-db-'));
process.env.DARSCHYN_DATA_DIR = isolatedData;

afterAll(() => {
  rmSync(isolatedData, { recursive: true, force: true });
});
