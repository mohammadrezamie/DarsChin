import { db } from '../server/db/database';

async function resetDemo() {
  console.log('Resetting demo environment...');
  await db.init(true);
  db.resetToSeed();
  console.log('Demo environment reset successfully.');
  process.exit(0);
}

resetDemo();
