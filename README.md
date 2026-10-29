# Attendance Desk

Automated attendance for AMIPI: Indore (BT Office), remote staff, and later Mumbai and New York.

It takes in the punch system's monthly file (uploaded, or emailed to hr@amipi.com) and reads HR emails with Claude. It then applies holiday calendars, leave and the attendance rules, sends reminders and an HR summary, and closes each month with an Excel package that is saved and emailed. Nothing needs approval. Every change is logged, and the original data is never changed.

| Folder | What it is |
|---|---|
| `frontend/` | The screens (React + TypeScript). See `frontend/README.md`. |
| `server/` | The server (Node.js + TypeScript, MySQL). See `server/README.md`. |
| `shared/` | The data model both use. |
| `deploy/` | `build.sh` makes the upload package for cPanel. |
| `docs/DEPLOY.md` | Step-by-step setup on InMotion cPanel. |
| `IMPLEMENTATION_PLAN.md`, `NEXT_STEPS.md` | Plan and open items. |
