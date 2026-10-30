# Attendance Desk (frontend)

The screens for the automated attendance tool (React + TypeScript + Vite). The same code runs in two ways:

- **With the real server:** the normal build. It talks to `/api` (see `../server`).
- **As a demo on sample data:** `npm run build:demo` makes one self-contained HTML file with invented people, for showing the tool without a server.

The tool approves nothing by hand. It applies emails, late data, holidays and joiner/leaver dates by itself, keeps the original data, and logs every change.

## Run it

```bash
npm install
```

With the server running (`cd ../server && npm run dev`):

```bash
npm run dev
```

Or on sample data only:

```bash
npm run dev:demo
```

| Command | What it does |
|---|---|
| `npm run build` | Build for the real server into `dist/` |
| `npm run build:demo` | One self-contained HTML file on sample data in `dist-single/` |
| `npm run typecheck` | Type-check only |

## Screens

| Screen | What it shows |
|---|---|
| Overview | What needs attention, what the tool did, month progress, offices, data sources |
| Attendance | Master grid for all offices. Click a day for times, issues and change history |
| Issues | Everything the daily check found and what happened to each item |
| HR emails | Each email, how the tool read it, and what it changed |
| Change log | Every change, with the reason and the source. Originals are kept |
| Reminders sent | Messages to employees, HR and management |
| Monthly report | Trends, repeat patterns, departments, and the summary that is emailed at month close |
| Past months | Every month with data, newest first: present rate, issues, unexplained absences and extra lates per month, the files used, and every saved report version to download |
| People | Employee list with join and leave dates |
| Attendance files | Upload the punch system's monthly file, and see every file received |
| Rules & calendars | Connections, shift times, thresholds, email confidence, reminders, month close, holiday calendars, user accounts. Saving re-checks every month |

## How the code is organised

```
src/
  types.ts          Data model. The backend returns exactly these shapes.
  api/client.ts     The AttendanceApi interface the screens use.
  api/http.ts       Real backend client, used when VITE_API_URL is set.
  api/index.ts      Picks sample data or the real backend.
  mock/             Sample data and a simulator that plays the backend's role.
  lib/              Date formatting, totals, CSV export, and stackTables.ts (see below).
  components/       Shared UI pieces and the bar chart.
  pages/            One file per screen, plus the side drawers.
```

## Small windows and phones

Every table inside a `.scroll` wrapper switches to one card per row, each value labelled with its column heading, whenever it does not fit its panel. `lib/stackTables.ts` measures this, so it adapts to the actual window, not to fixed breakpoints. The attendance grid (`.no-stack`) scrolls sideways instead.

## Talking to the server

`src/api/client.ts` lists everything the screens need. `src/api/http.ts` calls the server, and `src/mock/` is the sample-data version. The data model is in `../shared/types.ts`, shared with the server.

## Sample data

All names, emails and numbers are invented. The demo date is Thu 29 Oct 2026, with data up to Wed 28 Oct and history from May 2026.
