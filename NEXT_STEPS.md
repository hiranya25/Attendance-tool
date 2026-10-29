# Attendance Tool: Where We Are

Updated 29 Oct 2026.

## Built and tested

- **Screens and server**, ready for InMotion cPanel (Node.js + PostgreSQL). Setup steps: `docs/DEPLOY.md`.
- **Reads the punch system's monthly file** ("Month Date Wise Performance", .xls). Tested on the real September 2026 file: 22 people, 660 days.
- **Fully automatic, no approvals.** Holidays, joiners and leavers, HR emails and late punches are applied by the tool. Every change is logged and the original data is kept.
- **HR emails** at hr@amipi.com (Outlook) are read by an AI model (NVIDIA Nemotron, free key). Attendance files sent as attachments are imported automatically.
- **Reminders** go to employees, a daily summary to HR, and alerts for long absences and likely device problems.
- **Month close:** the Excel package (summary, master sheet, daily detail, issues, emails, change log) is saved on the site and emailed to the people you choose. If a newer file arrives later, a revised version is sent.
- **Holiday calendars** from HR's lists: US holidays (NY office and remote), NY shift (India), India day shift, and Mumbai office.

## What the September file showed

- **One remote employee's "0 hours"** is a missing punch-out almost every day, not missing work.
- **The punch system's own "late" flags are unreliable.** Everyone on shift E1 is marked late every day. The tool measures lateness against its own shift table instead.
- **Two long absences:** one person was absent all 21 working days, another for 6 days in a row. Either set a leaving date, or the tool keeps them as "Long absence".
- **Labor Day (7 Sep)** was marked as a holiday for most staff, but three remote staff worked that day. The tool notes this instead of counting it as a problem.
- **Mumbai and New York** are not in the punch file. They need their own source later.

## What I still need from you

1. **Deploy access:** do the steps in `docs/DEPLOY.md`, or give me what is needed and I'll walk you through it.
2. **Microsoft 365 admin** to register the app for hr@amipi.com (`docs/DEPLOY.md`, step 6).
3. **NVIDIA API key** from build.nvidia.com (step 7).
4. **October so far:** export October from the punch system now and upload it. A newer file replaces it later.
4. **Shift times:** the 7 shift codes (G, D, S1, E1, E4, G2, P1) are estimated from September data. Jainam should confirm them on the Rules page.
5. **Holiday dates to confirm:** Mumbai's Diwali week, Mumbai's Paryushan last day (not added yet), and whether US Independence Day (Sat 4 Jul) had a Friday off.
6. **Employee emails and joining dates**, so reminders reach people and new joiners are handled correctly.
7. **Who receives the monthly report.**

## Open questions (only if they matter)

- What do the punch remarks "M" and "EI" mean? (Probably "manual" and "early in".)
- Does anyone else get the 1.25 casual paid leaves per month? Leave balances can be added once leave rules are written down.
