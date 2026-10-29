# Attendance Desk (server)

Node.js + TypeScript. Reads the punch system's monthly file and the hr@amipi.com mailbox, applies the rules, sends reminders and summaries, closes each month and emails the Excel package. Nothing waits for an approval; every change is logged and the original data is kept.

## Run it locally

```bash
npm install
```

```bash
cp config.sample.json config.json
```

For a local database, set `"database": { "client": "better-sqlite3", "filename": "./storage/local.sqlite" }` in `config.json`.

```bash
npm run dev
```

In another terminal, from `../frontend`:

```bash
npm run dev
```

Open the address Vite prints. `/api` is passed to this server on port 3000.

| Command | What it does |
|---|---|
| `npm run build` | Type-checks, then bundles `dist/app.cjs`, `dist/cron.cjs`, `dist/cli.cjs` (no `node_modules` needed on the server) |
| `npm run typecheck` | Type-check only |

To deploy, use `bash ../deploy/build.sh` and follow `../docs/DEPLOY.md`.

## How it is organised

```
src/
  app.ts, server.ts      Start file and the Express app (API under /api, screens from ./public)
  cron.ts                The 15-minute automatic run
  cli.ts                 Server terminal commands (import a file, add a user, run once)
  config.ts, db.ts       config.json, and the database (PostgreSQL on the server, SQLite locally; MySQL also works)
  schema.ts, seed.ts     Tables, plus the starting calendars, shift times and rules
  import/                Reader for the punch system's .xls/.xlsx export, and the importer
  engine/monthBuilder.ts Builds a month from the raw rows: calendars, joiners/leavers, emails, rules, reminders
  ai/emailReader.ts      Claude reads one HR email and returns person, days, type and confidence
  mail/                  Microsoft Graph (read hr@, send mail) and the email log
  reports/               Excel workbook and the management summary
  jobs.ts                Mailbox, reminders, HR summary, month close
  api/                   Routes and sign-in
../shared/types.ts       The data model shared with the screens
```

## Main rules (all editable on the Rules page)

- Late, early and short hours are measured against the shift table, not the punch system's own flags. Those flags were found to be wrong: shift E1 was marked late every single day.
- Holidays come from each person's holiday calendar. A holiday sent as "absent" becomes a holiday; working on a holiday is noted.
- Days before joining or after leaving are "not employed", not absences.
- Five or more absences in a row become one "Long absence" item, and HR gets an alert.
- Three or more people with the same gap in one office on one day are marked "Likely system issue" and not counted against anyone.
- An HR email is applied when Claude's match confidence is 80% or more. Below that, the day is marked "Communicated, unclear".
