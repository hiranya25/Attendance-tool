# Attendance Desk (frontend)

The screens for the automated attendance tool. It runs fully on sample data today, and switches to the real backend when one exists.

The tool approves nothing by hand. It applies emails, late data, holidays and joiner/leaver dates by itself, keeps the original data, and logs every change.

## Run it

```bash
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173).

Other commands:

| Command | What it does |
|---|---|
| `npm run build` | Production build into `dist/` |
| `npm run build:single` | One self-contained HTML file in `dist-single/`, for sharing as a demo |
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
| People | Employee list with join and leave dates |
| Rules & calendars | Shifts, thresholds, email confidence, reminders, month close, holidays. Saving re-checks every month |

## How the code is organised

```
src/
  types.ts          Data model. The backend returns exactly these shapes.
  api/client.ts     The AttendanceApi interface the screens use.
  api/http.ts       Real backend client, used when VITE_API_URL is set.
  api/index.ts      Picks sample data or the real backend.
  mock/             Sample data and a simulator that plays the backend's role.
  lib/              Date formatting, totals, CSV export.
  components/       Shared UI pieces and the bar chart.
  pages/            One file per screen, plus the side drawers.
```

## Connecting the backend

Set `VITE_API_URL` (for example in `.env.local`) and the app calls these endpoints instead of the sample data:

| Method | Path | Returns |
|---|---|---|
| GET | `/reference` | `Reference`: offices, employees, holidays, settings, months |
| GET | `/months/{yyyy-mm}` | `MonthData`: records, issues, emails, changes, notifications, sources, close status |
| GET | `/trend` | `TrendPoint[]`, one per month |
| PUT | `/settings` | Saves `Settings`; the backend re-checks all months |
| PUT | `/holidays` | Saves `Holiday[]` |

`src/mock/simulate.ts` shows, step by step, what the backend has to do each day. It is the best starting point for writing the backend logic.

## Sample data

All names, emails and numbers are invented. The demo date is Thu 29 Oct 2026, with data up to Wed 28 Oct and history from May 2026.
