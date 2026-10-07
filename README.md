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
| Code.gs | Google Apps Script backend (goes into Google Sheets, not VS Code) |
| Tasks_sheet_model.csv | Sample of the Tasks sheet (optional test data) |

## Google Sheet model

The script creates two tabs automatically the first time they're needed.

**Users** – Name | Number | Email | Password (hashed) | Created On

**Tasks**

| Column | Field | Filled by | Values |
|---|---|---|---|
| A | Task ID | Auto | TSK-0001, TSK-0002 ... |
| B | Username | Auto (logged-in user) | Same as signup name |
| C | Task Title | User | Required |
| D | Description | User | Optional |
| E | Category | User | Audit & Compliance, IT & Assets, Operations, Marketing, Reporting, Meetings, Other |
| F | Priority | User | High / Medium / Low |
| G | Status | User | Not Started / Pending / Ongoing / Hold / Completed / Cancelled |
| H | Start Date | User | Required – the dashboard date range filters on this |
| I | Due Date | User | Optional – used for "Overdue" |
| J | Completed Date | Auto | Set when status becomes Completed, cleared if reopened |
| K | Remarks | User | Optional |
| L | Created On | Auto | Date + time |
| M | Last Updated | Auto | Date + time |

To test with sample data: in the Tasks tab, File > Import > Upload Tasks_sheet_model.csv >
"Replace current sheet". Change the Username column to your signup name, then delete the rows when done.

**Reminders** (created automatically on first use)

| Column | Field | Filled by |
|---|---|---|
| A | Reminder ID | Auto (RMD-0001 ...) |
| B | Username | Auto |
| C | Description | User |
| D | Priority | User (High / Medium / Low) |
| E | Category | User (Meeting, Mail, Update, Follow-up, Call, Payment, Other) |
| F-H | 1st / 2nd / Final Reminder | User (1st and Final required) |
| I | Status | Auto: Open / Extended / Closed |
| J | Times Extended | Auto |
| K | Original Final Date | Auto (saved on first extension) |
| L | Closed On | Auto |
| M | Closed On Time | Auto: Yes if closed on or before the final date |
| N | Notes | User + extension reasons |
| O-P | Created On / Last Updated | Auto |

**Calendar** (created automatically on first use)

| Column | Field | Filled by |
|---|---|---|
| A | Entry ID | Auto (CAL-0001 ...) |
| B | Username | Auto |
| C-D | Date / Day | User / Auto |
| E | Type | User: Plan or Actual |
| F-G | Start Time / End Time | User (9:00 to 18:00, 30-minute steps) |
| H | Hours | Auto |
| I | Activity | User (cell is coloured with the chosen colour) |
| J | Color | User |
| K | Notes | User |
| L-M | Created On / Last Updated | Auto |

## My Calendar
- Each day has two columns: **Plan** (what you planned) and **Actual** (what you really did).
- Click an empty slot to add an entry there; click an entry to edit, delete, or "Copy to Actual".
- "Both" adds the same entry to Plan and Actual. "Also add on" repeats it on other days of the same week.
- Click a day header to open that day on its own. Hours planned vs actual show under each column.

## Setup / update
1. Open your Google Sheet > Extensions > Apps Script. Replace everything with the new Code.gs and save.
2. Deploy > Manage deployments > pencil (Edit) > Version: **New version** > Deploy.
   The Web App URL stays the same, so script.js doesn't need changing.
   (First time? Deploy > New deployment > Web app, Execute as: Me, Who has access: Anyone,
   then paste the URL into script.js.)
3. In VS Code, right-click index.html > Open with Live Server.

## How the dashboard counts
- A task is counted in the date range when its **Start Date** falls inside the range.
- Total = all tasks in range; Completed / Pending / Ongoing / Hold = tasks with that status.
- Overdue = not completed and Due Date is before today.
- Clicking a task title on the dashboard opens it for editing on View & Edit Task.
