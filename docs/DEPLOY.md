# Putting Attendance Desk on InMotion (cPanel)

This guide takes about an hour the first time. You need:
- your cPanel login,
- someone who can sign in to Microsoft 365 as an admin (for step 6),
- an NVIDIA API key (step 7).

The app is a Node.js app with a PostgreSQL database. Everything is bundled, so the server never needs `npm install`.

## 1. Build the upload package

On any computer with Node.js 20 or newer, from the project folder, run:

```bash
bash deploy/build.sh
```

This creates `deploy/out/attendance-desk.zip`. It contains:

| File | What it is |
|---|---|
| `app.cjs` | The website and its API |
| `cron.cjs` | The automatic run (mailbox, reminders, summaries, month close) |
| `cli.cjs` | Admin commands for the server's terminal |
| `public/` | The screens |
| `config.sample.json` | Settings template |

## 2. Create the database

1. In cPanel, open **PostgreSQL Databases**.
2. Create a database, for example `attendance`. cPanel names it `CPANELUSER_attendance`.
3. Create a user with a strong password, for example `attendance`. cPanel names it `CPANELUSER_attendance`.
4. Under **Add User to Database**, add that user to the database. This gives it full access to that database.

Write down the database name, user name and password. The app creates its own tables the first time it starts.

The app can also use MySQL, if you ever move hosts. In `config.json`, set `"client": "mysql2"` and `"port": 3306`.

## 3. Create the address

In cPanel, open **Domains** and create a subdomain, for example `attendance.amipi.com`. A subdomain of its own is simplest.

Make sure it has an SSL certificate (cPanel's **SSL/TLS Status**, then **Run AutoSSL**), so the address starts with `https://`.

## 4. Upload the files

1. In **File Manager**, create a folder in your home directory, next to `public_html` and not inside it. For example `attendance-desk`.
2. Upload `attendance-desk.zip` into it and **Extract** it.
3. If you get an extra `attendance-desk/attendance-desk` level, move the files up one level.
4. Copy `config.sample.json` to `config.json` and edit it:

| Setting | Value |
|---|---|
| `appUrl` | `https://attendance.amipi.com` |
| `database.user`, `database.password`, `database.database` | From step 2. Leave `client` as `pg`, `host` as `localhost` and `port` as `5432` |
| `sessionSecret` | Any long random text (40+ characters) |
| `microsoft` | Leave empty for now. Step 6 fills it in. |
| `ai.apiKey` | Leave empty for now. Step 7 fills it in. Keep `provider`, `model` and `baseUrl` as they are |
| `sendEmail` | Set to `false` until you have checked everything. The tool then records every email it would send without sending it. |

Keep `config.json` private. It holds passwords and must never go inside `public_html`.

## 5. Start the app

1. In cPanel, open **Setup Node.js App**, then **Create Application**.
2. Fill it in:

| Field | Value |
|---|---|
| Node.js version | 20 or newer |
| Application mode | Production |
| Application root | `attendance-desk` |
| Application URL | `attendance.amipi.com` |
| Application startup file | `app.cjs` |

3. Click **Create**, then **Restart**.
4. Open `https://attendance.amipi.com`. You should see **Create the first admin account**. Create yours. Passwords need at least 8 characters, including a number.
5. Go to **Attendance files** and upload the latest "Month Date Wise Performance" export.

If the page does not load, the error is in `attendance-desk/stderr.log` (cPanel writes it there). Errors while running are also written to `attendance-desk/storage/logs/error.log`.

To check the tool is up at any time, open `https://attendance.amipi.com/api/health`. It shows `"ok": true` when the app and database are working, and the time of the last automatic run. You can give this address to an uptime monitor (for example UptimeRobot) to be alerted if it ever goes down.

If that log says **"permission denied for schema public"**, the database user is not allowed to create tables yet. This happens on newer PostgreSQL versions. Ask InMotion support to run this, using your real names:

```sql
GRANT ALL ON SCHEMA public TO CPANELUSER_attendance;
```

Then restart the app.

### The automatic run (cron job)

1. On the Setup Node.js App screen, copy the command shown at the top. It looks like `source /home/USER/nodevenv/attendance-desk/20/bin/activate && cd /home/USER/attendance-desk`. From it, note the path to `node`: `/home/USER/nodevenv/attendance-desk/20/bin/node`.
2. In cPanel, open **Cron Jobs** and add one that runs every 15 minutes (`*/15 * * * *`):

```bash
cd /home/USER/attendance-desk && /home/USER/nodevenv/attendance-desk/20/bin/node cron.cjs >> storage/cron.log 2>&1
```

Replace `USER` with your cPanel user name, and `20` with the Node.js version you picked.

After the first run, **Rules & calendars → Connections** shows "Last automatic run".

## 6. Connect Outlook (hr@amipi.com)

The tool reads new emails at hr@amipi.com (leave, sick days, late notes, and attendance files sent as attachments). It also sends reminders, summaries and the monthly report from the same mailbox. A Microsoft 365 admin does this once:

1. Go to **portal.azure.com**, then **Microsoft Entra ID**, then **App registrations**, then **New registration**.
2. Name it `Attendance Desk`, choose "Accounts in this organizational directory only", and click **Register**.
3. On the app's page, copy the **Application (client) ID** and the **Directory (tenant) ID**.
4. Open **Certificates & secrets**, then **New client secret**. Copy the **Value** straight away; it is shown only once.
5. Open **API permissions**, then **Add a permission**, then **Microsoft Graph**, then **Application permissions**. Add `Mail.Read` and `Mail.Send`, then click **Grant admin consent**.
6. **Recommended:** limit the app to the hr@amipi.com mailbox only, so it cannot read anyone else's mail. In Exchange Online this is done with an application access policy, or RBAC for Applications. Your Microsoft 365 admin will know which one your tenant uses.
7. Put the three values into `config.json` under `microsoft` (`tenantId`, `clientId`, `clientSecret`). Keep `mailbox` and `sender` as `hr@amipi.com`.
8. Restart the app in **Setup Node.js App**, then click **Run checks now** on the Rules page. The Outlook line should say **Connected**.

The tool reads mail from three days before it was connected onwards. It never deletes or moves anything in the mailbox.

## 7. Connect the AI that reads HR emails (NVIDIA Nemotron)

1. Go to **build.nvidia.com** and sign in. A free NVIDIA account is enough.
2. Search for the model **nemotron-3-ultra-550b-a55b** and open it.
3. Click **Get API Key** and copy it. It starts with `nvapi-`.
4. Put it into `config.json` under `ai.apiKey`, restart the app, and click **Run checks now** on the Rules page. The AI line should say **Connected**.

The AI only reads each email and reports who it is about, which days, what kind of absence it is, and how sure it is. The tool's own rules decide what changes.

**About the free key:**
- **Limits.** The free tier has a request limit. The tool waits 3 seconds between emails and reads at most 20 per 15-minute run. If NVIDIA still says it is busy, the rest are read on the next run. You can change this with `"maxPerRun"` and `"pauseSeconds"` under `ai` in `config.json`.
- **Privacy.** HR emails, including sick-leave details, are sent to NVIDIA's service to be read. Check that NVIDIA's terms for the free key suit company HR data, and that the founder is happy with it.

**Using Claude instead:** set `"ai": { "provider": "anthropic", "apiKey": "sk-ant-...", "model": "claude-opus-5-5" }` and restart.

## 8. Before switching email on

On the screens:
- **People:** add each person's email address (needed for reminders) and joining dates.
- **Rules & calendars, Shift timings:** the times are estimated from September data. Check them with Jainam, correct them, and tick "Confirmed".
- **Rules & calendars, Holiday calendars:** check the dates marked "Check date".
- **Rules & calendars, Month close and reports:** add the people who should receive the monthly report.

Use **Preview** on the Reminders page to see exactly what each email will say. Then set `"sendEmail": true` in `config.json` and restart the app.

To start with HR and report recipients only, turn **Remind employees** off on the Rules page first, and turn it on later. `docs/CHECKLISTS.md` has short lists to forward to each person involved.

## Everyday use

There is nothing to do. Either upload the punch system's monthly file on **Attendance files**, or email it to hr@amipi.com as an attachment. Its name must contain `monthdatewiseperformance`.

## Updating to a new version

1. Run `bash deploy/build.sh` again.
2. Upload and extract the new zip over the old files. `config.json` and `storage/` are not in the zip, so they are kept.
3. Click **Restart** in Setup Node.js App.

## Backups

- **Database:** cPanel's **Backup** page, or JetBackup if your plan has it.
- **Files:** the `storage/` folder holds every uploaded file and every monthly report. Include it in backups.

## Server commands

From cPanel's **Terminal**, after running the `source ... && cd ...` command from step 5:

```bash
node cli.cjs import /path/to/monthdatewiseperformance.xls
```

```bash
node cli.cjs add-user someone@amipi.com "Their Name" viewer "a-starting-password"
```

```bash
node cli.cjs reset-password someone@amipi.com "a-new-password1"
```

```bash
node cli.cjs run
```

Normally, an admin resets passwords on **Rules & calendars → Who can sign in → Set password**. Anyone can change their own password with the **My password** button at the top.

## Security built in

- **Passwords** need at least 8 characters, including a number. They are stored scrambled (scrypt), never as plain text.
- **Sign-in pauses for 15 minutes** after 5 wrong passwords for one account, or 20 from one address.
- **Viewers can see but not change** anything; only admins can upload files, edit people, change rules and manage accounts.
- **`config.json`, uploaded files and reports** stay outside the public website.
