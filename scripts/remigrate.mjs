// Re-imports the OLD ARCIS data (kv_data) into the new tables.
//
// Use it once, at the moment you switch from the old app to the new one,
// so the new app starts from the very latest old data.
// WARNING: everything entered in the NEW app is erased and replaced.
// The old kv_data table is never modified.
//
//   railway run npm run remigrate -- --yes
import 'dotenv/config';
import { createPgStore } from '../server/db.js';
import { runMigrationIfNeeded } from '../server/migrate.js';

if (!process.argv.includes('--yes')) {
  console.log('This erases all data entered in the new ARCIS and re-imports the old data.\nRun again with --yes to confirm.');
  process.exit(1);
}
const store = await createPgStore(process.env.DATABASE_URL);
await store.pool.query("DELETE FROM records; DELETE FROM app_meta WHERE key = 'migration_v3_done';");
const report = await runMigrationIfNeeded(store);
console.log(report ? 'Re-import complete.' : 'Nothing to import (no kv_data table).');
await store.pool.end();
