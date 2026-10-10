# Management Support – Login, Dashboard & Task Update

## Files (keep all in one folder in VS Code)
| File | What it is |
|---|---|
| index.html | Login page |
| signup.html | Signup page |
| home.html | Dashboard ("<username> Dashboard") |
| add-task.html | Add a new task |
| view-tasks.html | View, edit and delete tasks |
| add-reminder.html | Add a reminder |
| reminders.html | View, close, extend, edit and delete reminders |
| style.css | Styles for login + signup |
| dashboard.css | Styles for dashboard + task update |
| script.js | Server connection, login, signup (**paste your Web App URL here**) |
| shell.js | Shared code for logged-in pages (sidebar, username, log out) |
| dashboard.js | Dashboard cards and charts |
| task-form.js | Shared task form fields |
| add-task.js | Add Task page logic |
| view-tasks.js | View & Edit Task page logic |
| reminder-form.js / add-reminder.js / reminders.js | Reminder pages |
| calendar.html / calendar.js | My Calendar – Plan vs Actual, 9 AM to 6 PM, week or day view |
| popup.js / popup.css | Animated pop-ups and delete confirmation |
| api.js | Connects every page to the Supabase database (project URL + public key) |
| Tasks_sheet_model.csv | Sample of the Tasks sheet (optional test data) |

## Database (Supabase)
The app stores everything in Supabase (free plan). `api.js` holds the project URL and the public key.

| Table | What it holds |
|---|---|
| profiles | One row per person: name, mail ID, mobile number, role (Employee / Admin) |
| tasks | Tasks, numbered TSK-0001, TSK-0002... separately for each person |
| reminders | Reminders, numbered RMD-0001... separately for each person |
| calendar_entries | My Calendar entries (Plan / Actual, 9 AM – 6 PM) |

To browse everyone's data with names, open **Table Editor** and pick the views `team_tasks`, `team_reminders` or `team_calendar`.

Security rules (in the database): everyone sees only their own data; Admins can read everyone's data and edit tasks they assigned; employees can change only the status and remarks of tasks assigned to them. Passwords are stored one-way scrambled by Supabase and can't be viewed by anyone.

**Make someone Admin:** SQL Editor → `update public.profiles set role = 'Admin' where email = 'their@mail.com';` (they log out and in again).

**Reset a password:** Authentication → Users → the person → Send password recovery.

## My Calendar
- Each day has two columns: **Plan** (what you planned) and **Actual** (what you really did).
- Click an empty slot to add an entry there; click an entry to edit, delete, or "Copy to Actual".
- "Both" adds the same entry to Plan and Actual. "Also add on" repeats it on other days of the same week.
- Click a day header to open that day on its own. Hours planned vs actual show under each column.

## Setup / update
1. Supabase SQL Editor: run `supabase-setup.sql`, then `supabase-update-1.sql` (once each).
2. Authentication → Sign In / Providers → Email: turn **Confirm email** off (or keep it on and people must click the mail link before logging in).
3. Upload all files in this folder to the GitHub repo. No server or Apps Script needed.

## How the dashboard counts
- A task is counted in the date range when its **Start Date** falls inside the range.
- Total = all tasks in range; Completed / Pending / Ongoing / Hold = tasks with that status.
- Overdue = not completed and Due Date is before today.
- Clicking a task title on the dashboard opens it for editing on View & Edit Task.
