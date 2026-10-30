# Attendance Tool: Where We Are

Updated 30 Oct 2026.

## Built and tested

- **Screens and server**, ready for InMotion cPanel (Node.js + PostgreSQL). Setup steps: `docs/DEPLOY.md`.
- **Reads the punch system's monthly file** ("Month Date Wise Performance", .xls). Tested on the real September 2026 file: 22 people, 660 days.
- **Fully automatic, no approvals.** Holidays, joiners and leavers, HR emails and late punches are applied by the tool. Every change is logged and the original data is kept.
- **HR emails** at hr@amipi.com (Outlook) are read by an AI model (NVIDIA Nemotron, free key). Attendance files sent as attachments are imported automatically.
- **Reminders** go to employees, a daily summary to HR, and alerts for long absences and likely device problems.
- **Month close:** the Excel package (summary, master sheet, daily detail, issues, emails, change log) is saved on the site and emailed to the people you choose. If a newer file arrives later, a revised version is sent.
- **Holiday calendars** from HR's lists: US holidays (NY office and remote), NY shift (India), India day shift, and Mumbai office.

## Office rules now in the tool (from the founder's documents, 30 Oct 2026)

| Office | Attendance from | Working days | Late rule |
|---|---|---|---|
| Indore (BT Office) | Punch system export | Mon–Fri | Full Time 9:30–18:30 IST. Late after 15 min. 4 late marks a month allowed; each after that is flagged with the NY policy (one day's salary) |
| Remote team | Punch system export | Mon–Fri | Same as Indore |
| Mumbai | Monthly sheet (OK / L1 / A) | Mon–Sat | 10:00 start, 20 min grace, 4 late marks allowed; a late with overtime is not marked (the sheet already does this) |
| New York | HR emails only | Mon–Fri | 9:15–18:15 ET, tardy after 9:30, 4 allowed, then one day's salary per late mark. Leave and lates come from emails |

- **The team list** links everyone to their punch code (including nicknames like Jolly, Ryan, Irene) and adds managers, roles and emails. People marked **NA** are not tracked.
- **Weekend or holiday work** is noted on the day and counted in the summary (paid extra under the NY rules).

## What the September files showed

- **Indore lates by the 9:30 rule:** with Full Time starting 9:30 and 15 minutes' grace, most Indore staff arrive late more than 4 times. The punch system itself only flags people after about 10:00. Please confirm with Lokesh whether 9:30 + 15 minutes is really the rule in Indore.
- **Mumbai:** 9 late marks (all within the 4 allowed) and 10 absent days, including one 5-day absence (shown as a long absence).
- **One name on the Mumbai sheet is not on the team list**, and one person in the punch file is not on the team list either. Both are listed on the People page; add the missing nickname or update the team list.
- **One remote employee's "0 hours"** is a missing punch-out almost every day, not missing work.
- **Two long absences in Indore/remote:** one person absent all 21 working days, another for 6 days in a row.

## What I still need from you

1. **Deploy access:** do the steps in `docs/DEPLOY.md`, or give me what is needed and I'll walk you through it.
2. **Microsoft 365 admin** to register the app for hr@amipi.com (`docs/DEPLOY.md`, step 6).
3. **NVIDIA API key** from build.nvidia.com (step 7).
4. **October so far:** export October from the punch system now and upload it. A newer file replaces it later.
5. **Shift times:** Full Time (G) and New York are confirmed. **Day Time (D) timing from Lokesh**; the remote shift codes (S1, E1, E4, G2, P1) and Mumbai's end time are still estimates.
6. **Holiday dates to confirm:** Mumbai's Diwali week, Mumbai's Paryushan last day (not added yet), and whether US Independence Day (Sat 4 Jul) had a Friday off.
7. **Employee emails and joining dates**, so reminders reach people and new joiners are handled correctly.
8. **Who receives the monthly report.**

## Open questions (only if they matter)

- What do the punch remarks "M" and "EI" mean? (Probably "manual" and "early in".)
- Does anyone else get the 1.25 casual paid leaves per month? Leave balances can be added once leave rules are written down.
