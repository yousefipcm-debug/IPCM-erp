# OSSATURE

OSSATURE is the management platform for IPCM BOUTEMA: treasury, client and supplier accounts, projects, staff and work sites.
It replaces ARCIS (version 2) with a full rebuild. It keeps all the existing ARCIS data and converts it automatically.

**Stage 1 (this delivery):** login, overview, alerts, projects, the complete DFC module, and user administration.
RH, Technique, Commercial, Documents and Secrétariat show a "bientôt" page until the next stages. Their data is already migrated.

## What changed from ARCIS

| Problem in ARCIS | OSSATURE |
|---|---|
| Workers, projects and pointage were identified by their position in a list. Deleting one shifted everyone after it. | Every record has a permanent ID. |
| Every save sent a whole list, so the last person to save erased their colleagues' changes. | Only the edited record is saved. If someone else changed it in the meantime, the app warns you and merges the two edits. |
| Journal payments were copied into situations, supplier invoices and projects, and the copies could drift apart. | A payment is stored once, on the transaction. All balances are calculated from it. |
| Recording a payment on a situation didn't change the cash or bank balance. | **Encaisser** and **Payer** create a real journal entry. Payments made outside the journals are labelled *hors trésorerie*. |
| The Commercial role couldn't save the client debt created by an invoice. | Permissions are defined per collection on the server. |
| Default passwords were visible in the page source, and the login secret had a hard-coded fallback. | Passwords exist only on the server. New accounts must change their password at first login, and login attempts are rate-limited. |
| The backup export left out the pointage, HR documents, the cash box and more. | All data lives in Postgres. Each screen also exports to Excel. |

Other additions: changes from colleagues appear automatically every 15 seconds, the search opens with **Ctrl K**, there's a dark mode, a phone layout with bottom tabs, an activity log, a client and supplier account statement, a 3-month cash forecast, and company details are editable in one place for every printed letterhead.

## Deploy on Railway

Test the new version next to the old one before you replace it.

1. Push this folder to a new GitHub repository.
2. In your Railway project, click **New → GitHub Repo** and select the repository.
3. In the new service, open **Variables** and add:
   - `DATABASE_URL`: reference the existing Postgres database (`${{Postgres.DATABASE_URL}}`).
   - `JWT_SECRET`: a long random string.
4. Deploy. In the logs, look for `[migration] done`, followed by the number of records converted.
5. Open the new service's URL and sign in with your **current** ARCIS username and password.

The migration only reads the old `kv_data` table and never modifies it, so the old app keeps working during the test.

### Switch over

Once you're happy with OSSATURE:

1. Ask everyone to stop entering data in the old app.
2. Re-import the latest old data into the new app:
   ```bash
   railway run npm run remigrate -- --yes
   ```
   > **Warning:** this erases everything entered in the new app during the test.
3. Move your domain to the new service, then delete the old service.

## Run locally

```bash
npm install
cp .env.example .env      # set DATABASE_URL to a local Postgres
npm run build && npm start
```

Open http://localhost:3000. Without `DATABASE_URL`, the server uses temporary in-memory storage.

During development, run `npm run dev` to reload the interface on every change. Run `npm test` to test the migration.

## Project structure

```
server/
  index.js        API: login, sync, records, users, OCR
  db.js           PostgreSQL storage (one row per record, versions)
  permissions.js  What each role can read and write
  migrate.js      Conversion of ARCIS data
client/src/
  lib/            Data store, finance calculations, formatting, printing
  components/     Design system (ui/), shell (layout/), finance dialogs
  pages/          One file per screen
```

## Next stages

1. RH: personnel, contracts, work sites, pointage, salaries.
2. Technique: work sites and general pointage.
3. Commercial: contacts and invoicing (factures and proformas).
4. Documents and Secrétariat: document folders, scanning, review queue.
