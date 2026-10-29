# Attendance Tool: Implementation Plan

Updated 29 Oct 2026. The tool runs by itself: no HR approvals anywhere. Every change it makes is logged and the original data is always kept.

**Done so far:** the screens (`frontend/`), running on sample data.

**Total time:** about 14 weeks from the day the inputs arrive. Each phase ends with something you can see and use.

---

## Phase 0: Collect the inputs (week 1)

**Owner:** you, with Jainam and the founder.

- Answers to the 8 questions in `NEXT_STEPS.md`.
- The 7 items: one month of login/logout data per office, how each system exports, the timing rules, the employee list, the 2026 holiday lists, HR mailbox details, and the founder's OK for AI to read HR emails.
- Jainam's final attendance file for the same month, so we can compare results later.

**Done when:** all of the above is in one shared folder.

---

## Phase 1: First real version (weeks 2 to 3)

**What gets built**
- The backend (the "engine room"), with a database that keeps original data untouched.
- Employee list, holiday calendars and timing rules loaded in.
- A reader for the monthly summary files you already have (like the Jan and Feb 2026 files).
- The screens connected to real data instead of sample data.
- Downloadable master attendance file and issues report in Excel.

**Done when:** you can upload the Jan and Feb 2026 files and see the real master sheet, issues and change log in the tool.

---

## Phase 2: Daily attendance data (weeks 4 to 6)

**What gets built**
- One reader per source: Indore, Mumbai, New York and the remote tracker.
- An automatic collection every morning at 06:00 IST.
- Login/logout checks: late, early, missing punch, short hours, duplicates and odd login times, each in the office's own time zone.
- "Likely system issue" when many people in one office have the same gap on the same day.
- Late punches that arrive later fill in the gap automatically.

**Depends on:** how each system exports data. If a system can only export by hand, someone drops the file in a shared folder each day and the tool picks it up.

**Done when:** the tool updates itself each morning with no one touching it.

---

## Phase 3: HR emails (weeks 7 to 8)

**What gets built**
- A connection to hr@amipi.com (Outlook or Google).
- AI reads each email and works out the person, the days and the type (sick, planned, unpaid, late, early).
- At 80% match confidence or more, attendance is updated automatically. Below that, the day is marked "Communicated, unclear".
- Emails that are not about attendance are ignored.

**Depends on:** the founder's OK and mailbox access.

**Done when:** a test email to hr@ shows up in the tool and changes the right day within minutes.

---

## Phase 4: Reminders and alerts (week 9)

**What gets built**
- An email to the employee the next working day about a missing punch or an unexplained absence.
- A daily summary email to HR (for information only).
- An alert to HR when a device or sync problem is likely.

**Done when:** reminders go out on their own and replies come back into the tool through the hr@ mailbox.

---

## Phase 5: Month close and reports (week 10)

**What gets built**
- Automatic month close on the 1st at 06:00.
- An email package to the agreed people: master Excel file, issues report and management summary.
- Trends against earlier months, repeat patterns, and department and office summaries.

**Done when:** the October or November package arrives in your inbox with no one pressing a button.

---

## Phase 6: Go live (weeks 11 to 14)

**What gets built**
- Hosting on a company server or in the cloud (founder's choice).
- Login, so each person sees only what they should: HR and management see everything, managers see their team.
- Daily backups.

**Trial run:** Jainam keeps doing the month by hand while the tool runs alongside for one full month. We compare the two results and fix any differences.

**Done when:** the tool's month matches Jainam's (or the differences are understood), and you switch over. Jainam moves from doing the work to checking the results.

---

## After go-live (ongoing, a few minutes a month)

- Add new joiners and leavers to the employee list (or have it sync from HR records).
- Upload next year's holiday lists each December.
- Adjust rules on the Rules page if policy changes. Every change is logged.

## What could slow things down

| Risk | What we do |
|---|---|
| A system has no automatic export | Use a shared drop folder until an automatic export is set up |
| Remote logins are self-reported | The tool collects and checks them, but cannot prove them |
| Mailbox access or AI approval is delayed | Phases 1, 2, 4 and 5 go ahead; emails are added later |
| Rules are unclear | Use Jainam's current practice and adjust on the Rules page |

## Summary timeline

| Weeks | Phase | You will have |
|---|---|---|
| 1 | 0. Inputs | Everything needed to start |
| 2–3 | 1. First real version | Real data in the screens, Excel downloads |
| 4–6 | 2. Daily data | Automatic daily updates from every office |
| 7–8 | 3. HR emails | Emails applied automatically |
| 9 | 4. Reminders | Employees and HR notified automatically |
| 10 | 5. Month close | Monthly package emailed automatically |
| 11–14 | 6. Go live | Live tool, trial month alongside Jainam, then switch |
