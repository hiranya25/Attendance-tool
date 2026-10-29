# Attendance Desk

Automated attendance for AMIPI: Indore (BT Office), remote staff, and later Mumbai and New York.

It takes in the punch system's monthly file (uploaded, or emailed to hr@amipi.com) and reads HR emails with Claude. It then applies holiday calendars, leave and the attendance rules, sends reminders and an HR summary, and closes each month with an Excel package that is saved and emailed. Nothing needs approval. Every change is logged, and the original data is never changed.

| Folder | What it is |
|---|---|
| `frontend/` | The screens (React + TypeScript). See `frontend/README.md`. |
| `server/` | The server (Node.js + TypeScript, PostgreSQL). See `server/README.md`. |
| `shared/` | The data model both use. |
| `deploy/` | `build.sh` makes the upload package for cPanel. |
| `docs/DEPLOY.md` | Step-by-step setup on InMotion cPanel. |
| `IMPLEMENTATION_PLAN.md`, `NEXT_STEPS.md` | Plan and open items. |

## Run it on your own computer

This runs the full tool, with sign-in, uploads, rules and the Excel workbook, on your computer only. It uses a small local database file instead of PostgreSQL, and sends no emails.

### 1. Install the tools (once)

- **Node.js 22 LTS** from https://nodejs.org (the "LTS" download). Any version from 20 up works.
- **Git** from https://git-scm.com.

To check they are installed, open a terminal (Windows: "Terminal" or "Command Prompt"; Mac: "Terminal") and run:

```bash
node --version
```

```bash
git --version
```

### 2. Get the code (once)

```bash
git clone https://github.com/hiranya25/Attendance-tool.git
```

```bash
cd Attendance-tool
```

```bash
git checkout main
```

To test work that has not been merged into `main` yet, use `git checkout claude/epic-pasteur-6bff8y` instead of the last command.

### 3. Install the parts (once, and again after you pull new changes)

```bash
cd server
```

```bash
npm install
```

```bash
cd ../frontend
```

```bash
npm install
```

```bash
cd ..
```

### 4. Create the local settings file (once)

In the `server` folder, create a new file called `config.json` and paste this into it:

```json
{
  "appUrl": "http://localhost:3000",
  "timezone": "Asia/Kolkata",
  "database": { "client": "better-sqlite3", "filename": "./storage/local.sqlite" },
  "storageDir": "./storage",
  "sessionSecret": "any-long-random-text-for-local-testing",
  "microsoft": { "tenantId": "", "clientId": "", "clientSecret": "", "mailbox": "hr@amipi.com", "sender": "hr@amipi.com" },
  "anthropic": { "apiKey": "", "model": "claude-opus-5-5" },
  "sendEmail": false
}
```

Also create an empty folder called `storage` inside the `server` folder. The database file and every uploaded file and report are kept there. Delete that folder any time you want to start again from scratch.

`config.json` and `storage` are never uploaded to GitHub.

### 5. Start it

Use option A to try the tool. Use option B while changing the code.

**Option A: one window, the same as on the live server**

```bash
cd frontend
```

```bash
npm run build
```

```bash
cd ../server
```

```bash
npm run build
```

```bash
npm start
```

Open **http://localhost:3000**. Leave the terminal open while you use it, and press `Ctrl + C` in it to stop.

**Option B: two windows, the page updates as you edit**

In the first terminal:

```bash
cd server
```

```bash
npm run dev
```

In a second terminal:

```bash
cd frontend
```

```bash
npm run dev
```

Open **http://localhost:5173**.

### 6. Try it out

1. **Create the first admin account.** It is only stored on your computer.
2. Go to **Attendance files** and upload the punch system's "Month Date Wise Performance" `.xls` file, for example the September 2026 one.
3. Look through **Overview**, **Attendance** (click any day), **Issues** and **People**.
4. On **People**, click a person, then **Edit details**. Add an email or a leaving date, and watch their issues change.
5. On **Rules & calendars**, change a shift time or the late grace period and save. Every month is checked again straight away, and the change appears in **Change log**.
6. On **Monthly report**, click **Download full workbook** to get the Excel file.
7. On **Rules & calendars**, click **Run checks now**. This is what the server does every 15 minutes: it reads the mailbox, sends reminders and closes months. Locally, Outlook and Claude show "Not set up" and nothing is emailed. Every message the tool would send is listed on **Reminders sent**.

### Optional: test HR email reading on your computer

Put a Claude API key in `anthropic.apiKey`, and the Microsoft 365 app details in `microsoft` (see `docs/DEPLOY.md`, steps 6 and 7). Then restart, and click **Run checks now**. Keep `"sendEmail": false`, so nothing is emailed to employees while testing.

### Other useful commands

| Command (run in the `server` folder) | What it does |
|---|---|
| `npm test` | Runs the automatic tests |
| `npm run typecheck` | Checks the code for mistakes without running it |
| `node dist/cli.cjs import path/to/file.xls` | Imports a punch file without the website (after `npm run build`) |
| `npm run cron` | Runs the 15-minute automatic run once (after `npm run build`) |

| Command (run in the `frontend` folder) | What it does |
|---|---|
| `npm run dev:demo` | The screens on invented sample data, with no server needed |
| `npm run build:demo` | The demo as one HTML file in `dist-single/`, for sharing |

### If something goes wrong

| Problem | Fix |
|---|---|
| `config.json is missing` | Step 4. The file must be inside the `server` folder and named exactly `config.json` |
| `npm install` fails on `better-sqlite3` | Use Node.js 20 or 22 LTS, delete `server/node_modules`, and run `npm install` again |
| `Port 3000 is already in use` | Another copy is still running. Close it, or stop it with `Ctrl + C` in its terminal |
| The page says the screens are not installed | Run `npm run build` in the `frontend` folder first (option A) |
| You forgot your local password | Delete the `server/storage` folder and start again |
