# Attendance Tool: Implementation Plan

Updated 29 Oct 2026. The tool runs by itself: no HR approvals anywhere. Every change it makes is logged and the original data is always kept.

## Where we are

**Built and tested** (on the real September 2026 punch file):

| Part | What it does |
|---|---|
| Screens | Overview, master attendance, issues, HR emails, change log, reminders, monthly report, people, attendance files, rules and calendars, sign-in |
| Server | Node.js + PostgreSQL, ready for InMotion cPanel. Bundled, so the server needs no `npm install` |
| File import | Reads the punch system's "Month Date Wise Performance" export, uploaded on the site or emailed to hr@amipi.com |
| Rules | Late, early, short hours, missing punches, absences, long absences, and likely device faults, measured against an editable shift table |
| Calendars | HR's 2026 lists: US holidays, NY shift (India), India day shift, Mumbai office |
| HR emails | Claude reads hr@amipi.com (Outlook) and applies leave and late notes automatically |
| Messages | Employee reminders, HR daily summary, alerts for long absences and device problems |
| Month close | Excel package saved on the site and emailed. A revised version is sent if a newer file arrives |

**Not live yet.** The remaining work is mostly setup and checking, not building.

---

## Phase 1: Put it online (week of 2 Nov)

**Owner:** you, or whoever manages the InMotion account. I can guide you through each step.

1. Run `bash deploy/build.sh` to make the upload zip.
2. In cPanel: create the PostgreSQL database, the subdomain (for example attendance.amipi.com) and its SSL certificate.
3. Upload the zip, fill in `config.json`, and start it with **Setup Node.js App**.
4. Add the cron job that runs every 15 minutes.
5. Create your admin account and upload the September file.

Keep `"sendEmail": false` for now, so nothing is emailed yet.

**Done when:** you can sign in at the new address and see September's data.

Full steps: `docs/DEPLOY.md`, steps 1 to 5.

---

## Phase 2: Connect Outlook and Claude (week of 2 Nov, can run alongside Phase 1)

**Owner:** your Microsoft 365 admin (about 10 minutes), and you for the Claude key.

1. Register the "Attendance Desk" app in Microsoft Entra with the `Mail.Read` and `Mail.Send` permissions, ideally limited to the hr@amipi.com mailbox only.
2. Create a Claude API key at console.anthropic.com, with a monthly spend limit if wanted.
3. Put both into `config.json`, restart the app, and click **Run checks now**.

**Done when:** the Rules page shows Outlook and Claude as **Connected**. A test email to hr@ ("I'm on sick leave tomorrow") then appears on the HR emails page, matched to the right person and day.

Full steps: `docs/DEPLOY.md`, steps 6 and 7.

---

## Phase 3: Fill in what the tool cannot guess (weeks of 2 and 9 Nov)

**Owner:** you and Jainam, all done on the screens.

| What | Where | Why it matters |
|---|---|---|
| Confirm the 7 shift times (G, D, S1, E1, E4, G2, P1) | Rules, Shift timings | Late and early flags depend on them. They are estimated today |
| Employee email addresses | People | Reminders cannot reach anyone without them |
| Joining and leaving dates | People | Stops new joiners and leavers showing up as absent |
| Nicknames used in emails | People | Helps Claude match emails like "Jolly" or "Anna" |
| Mumbai Diwali week and Paryushan date, and any observed days | Rules, Holiday calendars | Currently marked "Check date" or missing |
| Who receives the monthly report | Rules, Month close and reports | Nobody is set yet |

**Done when:** the shift table shows every shift as "Confirmed", and the People page shows no "No email yet".

---

## Phase 4: Trial month alongside Jainam (November 2026)

**Owner:** Jainam, with me fixing anything that differs.

1. Upload the October file when it is ready. Jainam keeps doing October and November by hand as usual.
2. Compare the tool's monthly workbook with Jainam's final file, person by person.
3. Fix any differences on the Rules page (shift times, grace period, calendars), or tell me and I change the logic.
4. Halfway through the month, set `"sendEmail": true`. Start with report recipients and HR only, then switch on employee reminders.

**Done when:** October and November match Jainam's results, or every difference is understood and agreed.

**Important limit:** reminders only help while the month is still running. If the punch file only comes once a month, reminders about old days are skipped (the Rules page sets the window, 7 days by default). For timely reminders, ask whether the punch system can export weekly or daily, or send the file to hr@ more often.

---

## Phase 5: Switch over (December 2026)

- The tool closes November on its own (3 Dec by default) and emails the package.
- Jainam moves from doing the work to checking the tool's results and the "Needs attention" list.
- Keep the manual method for one more month as a safety net, then stop.

**Done when:** a month closes with nobody pressing a button, and HR and management use the emailed package.

---

## Phase 6: After go-live (from January 2027, as needed)

| Addition | What is needed first |
|---|---|
| Mumbai office attendance | Which system Mumbai uses, and a sample export |
| New York office attendance | The same, for New York |
| More frequent punch data (weekly or daily) | Whether the punch system can export or email automatically |
| Leave balances (1.25 casual paid leaves per month worked, 1 if under a year) | Written leave rules and opening balances |
| Manager view (each manager sees their own team) | A list of who reports to whom |
| 2027 holiday lists | HR's lists, entered on the Rules page in December |

---

## Ongoing upkeep (a few minutes a month)

- Upload the monthly punch file, or email it to hr@amipi.com. Its name must contain "monthdatewiseperformance".
- Add each new joiner's email and joining date on the People page. New people are added automatically from the file.
- Enter next year's holidays each December.
- Back up the database and the `storage` folder (cPanel Backup).

## What could slow things down

| Risk | What we do |
|---|---|
| Microsoft 365 admin access takes time | Everything else goes live; uploads still work and emails are added later |
| Shift times are wrong | Late flags will be off. Fix them on the Rules page; every month is re-checked straight away |
| InMotion plan has no "Setup Node.js App" | Ask InMotion support to enable it, or move to a plan that has it |
| Punch file comes only monthly | Reports and the month close still work fully. Reminders are limited, see Phase 4 |
| Emails in mixed Hindi and English, or from personal addresses | Claude gives lower confidence and the day is kept as "Communicated, unclear". Adjust the 80% threshold if needed |

## Timeline

| When | Phase | You will have |
|---|---|---|
| Week of 2 Nov | 1. Put it online | The tool live at its own address with September data |
| Week of 2 Nov | 2. Connect Outlook and Claude | HR emails read and applied automatically |
| Weeks of 2 and 9 Nov | 3. Fill in details | Confirmed shifts, emails, dates and report recipients |
| November | 4. Trial month | October and November checked against Jainam's results |
| December | 5. Switch over | The month closes and reports go out on their own |
| From January 2027 | 6. Additions | Mumbai, New York, leave balances, as needed |
