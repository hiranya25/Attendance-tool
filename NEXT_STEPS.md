# Attendance Tool: Next Steps (Revised)

Updated 29 Oct 2026. This replaces the earlier plan where it disagrees.

## The big change: fully automated, no approvals

The tool decides and records everything by itself. Nobody has to click "approve".

| Before | Now |
|---|---|
| HR confirms each email match | Tool matches the email to the person and date and updates the record |
| HR approves each correction | Tool applies the correction and logs it |
| HR locks the month | Tool closes the month automatically on a set date |

Nothing is ever deleted or overwritten. The original data is kept, and every change is logged:
what changed, when, why, and what caused it (for example "sick-leave email from X on 3 Feb").
Anyone can look back at the log at any time.

Two safety rules stay in, because they cost nothing and avoid unfair results:
- If an email match is unclear, the tool marks the day "Communicated - unclear" instead of guessing. It is still tracked.
- Problems are labelled "Needs attention", never "Offence". If many people miss a punch on the same day in the same office, the tool labels it "Likely system issue".

## What the tool will do, every day, by itself

1. Collect the attendance files from each office and the remote logins.
2. Read new emails at hr@amipi.com and match them to the person and date.
3. Check every day against the rules and holidays, and list problems.
4. Email employees about their own missing punches, and send a daily summary to HR (for information only).

## What it will do at month-end, by itself

1. Build the master attendance Excel file.
2. Build the exception report.
3. Build a short management summary (patterns, repeat issues, comparison with last month).
4. Email all three to the agreed people.

## What I need from you (7 things)

1. **Raw attendance data.** One full month of login/logout times from each place: Indore, Mumbai, New York and remote staff. (The two files you gave me only have daily P/A codes, not times.)
2. **Can these be downloaded automatically?** Ask Jainam: which software each office uses, and whether we can get a daily export without someone clicking a button.
3. **The rules.** Office timings, grace period for late, half-day rule, minimum hours. A one-page note from Jainam is enough.
4. **Employee list.** Code, name, office, shift, joining date, leaving date, email address.
5. **Holiday lists for 2026** for India and New York.
6. **HR mailbox access.** Is hr@amipi.com on Microsoft 365 (Outlook) or Google? Who can give access?
7. **Founder's OK** that an AI service can read the hr@ emails (they include sick-leave details).

## The only questions to ask Jainam

1. Which systems record attendance in each office and for remote staff, and can they export automatically?
2. What are the timing rules (start time, grace, half day, minimum hours)?
3. How do you record leave today? (The system shows leave as 0 for everyone.)
4. What do you fix by hand every month? Give your top 5 examples.
5. Do people report absence anywhere other than hr@ email (WhatsApp, phone)?

## The only questions for the founder

1. Is it OK for an AI service to read HR emails, including sick leave?
2. Who should receive the month-end reports?
3. Where should the tool run: company server or cloud?

## Build order

The screens are built (see `frontend/`). They run on sample data until the backend exists.

| Step | What | Needs |
|---|---|---|
| 1 | Read the monthly summary files and produce the exception report | Nothing more; can start now with the Jan and Feb 2026 files |
| 2 | Read raw login/logout data and build the master file | Items 1, 3, 4, 5 |
| 3 | Read and match HR emails automatically | Items 6, 7 |
| 4 | Daily reminders and month-end auto-reports | Item 2 and the employee email addresses |
| 5 | Run beside Jainam for one month and compare, then switch | Jainam's final file for that month |

## What the Jan and Feb files already show

- No login/logout times, so the tool cannot work out late arrivals or early exits from these files.
- Only two groups (BT Office and Remote). No Mumbai or New York data.
- Leave is not recorded, so sick leave and vacation show as "A" (absent).
- New joiners and people who left show as long runs of absence.
- 26 Jan (Republic Day) is marked present for everyone; 1 Jan is marked holiday.
- Some people are present but show 0 or very low hours, and one person's overtime equals their total hours. These look like setup problems in the attendance software.
