// =============================================================
// Google Apps Script backend — paste into Extensions > Apps Script
// Handles: signup, login (Admin / Employee) with session tokens,
// tasks (get/add/update/delete + admin assign), reminders and calendar
// =============================================================

const USERS_SHEET = "Users";
const TASKS_SHEET = "Tasks";
const TASK_HEADERS = [
  "Task ID", "Username", "Task Title", "Description", "Category", "Priority",
  "Status", "Start Date", "Due Date", "Completed Date", "Remarks",
  "Created On", "Last Updated", "Assigned By"
];
const STATUSES = ["Not Started", "Pending", "Ongoing", "Hold", "Completed", "Cancelled"];
const PRIORITIES = ["High", "Medium", "Low"];

function book() { return SpreadsheetApp.getActiveSpreadsheet(); }
function tz() { return book().getSpreadsheetTimeZone(); }

// ---------- Sheets (created automatically if missing) ----------
function getUsersSheet() {
  let sheet = book().getSheetByName(USERS_SHEET);
  if (!sheet) {
    sheet = book().insertSheet(USERS_SHEET);
    sheet.appendRow(["Name", "Number", "Email", "Password (hashed)", "Created On", "Role"]);
    styleHeader(sheet, 6);
  }
  // Older sheets: add the Role column header if it's missing
  if (!sheet.getRange(1, 6).getValue()) {
    sheet.getRange(1, 6).setValue("Role");
    styleHeader(sheet, 6);
  }
  return sheet;
}

function getTasksSheet() {
  let sheet = book().getSheetByName(TASKS_SHEET);
  if (!sheet) {
    sheet = book().insertSheet(TASKS_SHEET);
    sheet.appendRow(TASK_HEADERS);
    styleHeader(sheet, TASK_HEADERS.length);
  }
  if (!sheet.getRange(1, 14).getValue()) {           // older sheets: add "Assigned By"
    sheet.getRange(1, 14).setValue("Assigned By");
    styleHeader(sheet, 14);
  }
  ensureDropdowns(sheet);
  return sheet;
}

// Dropdowns so edits made directly in the sheet stay valid.
// Re-applied automatically whenever the status list changes.
function ensureDropdowns(sheet) {
  const rule = sheet.getRange("G2").getDataValidation();
  const current = rule ? rule.getCriteriaValues()[0] : [];
  if (Array.isArray(current) && current.join("|") === STATUSES.join("|")) return;
  sheet.getRange("F2:F").setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(PRIORITIES, true).build());
  sheet.getRange("G2:G").setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build());
}

function styleHeader(sheet, cols) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, cols)
    .setFontWeight("bold").setBackground("#5b2a86").setFontColor("#ffffff");
}

// ---------- Helpers ----------
function hashPassword(password) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return bytes.map(b => ("0" + (b & 0xff).toString(16)).slice(-2)).join("");
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function fmt(value, pattern) {
  if (value instanceof Date) return Utilities.formatDate(value, tz(), pattern);
  return value === null || value === undefined ? "" : String(value);
}

function todayStr() { return Utilities.formatDate(new Date(), tz(), "yyyy-MM-dd"); }

// Stops text like "=SUM(...)" being run as a formula
function clean(v) {
  const s = String(v || "").trim();
  return /^[=+@]/.test(s) ? "'" + s : s;
}

function rowToTask(r) {
  return {
    id: String(r[0]),
    username: String(r[1]),
    title: String(r[2]),
    description: String(r[3]),
    category: String(r[4]),
    priority: String(r[5]),
    status: String(r[6]),
    startDate: fmt(r[7], "yyyy-MM-dd"),
    dueDate: fmt(r[8], "yyyy-MM-dd"),
    completedDate: fmt(r[9], "yyyy-MM-dd"),
    remarks: String(r[10]),
    createdOn: fmt(r[11], "yyyy-MM-dd HH:mm"),
    updatedOn: fmt(r[12], "yyyy-MM-dd HH:mm"),
    assignedBy: String(r[13] || "")
  };
}

function validateTask(t) {
  const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!t || !String(t.title || "").trim()) return "Task title is required.";
  if (!isDate(t.startDate)) return "Start date is required.";
  if (t.dueDate && !isDate(t.dueDate)) return "Due date is not valid.";
  if (t.dueDate && t.dueDate < t.startDate) return "Due date can't be before the start date.";
  if (STATUSES.indexOf(t.status) === -1) return "Status must be one of: " + STATUSES.join(", ") + ".";
  if (PRIORITIES.indexOf(t.priority) === -1) return "Priority must be High, Medium or Low.";
  return "";
}

function nextTaskId(sheet) {
  const ids = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat() : [];
  const max = ids.reduce((m, id) => Math.max(m, parseInt(String(id).replace(/\D/g, ""), 10) || 0), 0);
  return "TSK-" + String(max + 1).padStart(4, "0");
}

// ---------- Actions ----------
function strongPasswordError(p) {
  p = String(p || "");
  if (p.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(p)) return "Password needs at least one uppercase letter.";
  if (!/[a-z]/.test(p)) return "Password needs at least one lowercase letter.";
  if (!/[0-9]/.test(p)) return "Password needs at least one number.";
  if (!/[^A-Za-z0-9]/.test(p)) return "Password needs at least one special character.";
  return "";
}

function signup(data) {
  const sheet = getUsersSheet();
  const rows = sheet.getDataRange().getValues().slice(1);
  const name = String(data.name || "").trim();
  const email = String(data.email || "").trim().toLowerCase();
  const number = String(data.number || "").trim();
  const role = data.role === "Admin" ? "Admin" : "Employee";

  if (name.length < 2) return { status: "error", message: "Enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: "error", message: "Enter a valid mail ID." };
  if (!/^[0-9]{10}$/.test(number)) return { status: "error", message: "Mobile number must be 10 digits." };
  const pwError = strongPasswordError(data.password);
  if (pwError) return { status: "error", message: pwError };
  if (rows.some(r => String(r[2]).trim().toLowerCase() === email))
    return { status: "error", message: "That mail ID already has an account. Log in instead." };
  if (rows.some(r => String(r[0]).trim().toLowerCase() === name.toLowerCase()))
    return { status: "error", message: "Someone is already registered with the name \"" + name + "\". Add your initial, e.g. \"" + name + " K\"." };

  sheet.appendRow([clean(name), "'" + number, clean(email), hashPassword(data.password), new Date(), role]);
  return { status: "success" };
}

// =============================================================
// SESSIONS (login token) — every request after login must carry it
// =============================================================
const SESSIONS_SHEET = "Sessions";
const SESSION_HOURS = 12;

function getSessionsSheet() {
  let sheet = book().getSheetByName(SESSIONS_SHEET);
  if (!sheet) {
    sheet = book().insertSheet(SESSIONS_SHEET);
    sheet.appendRow(["Token", "Name", "Role", "Expires"]);
    styleHeader(sheet, 4);
    sheet.hideSheet();
  }
  return sheet;
}

function createSession(name, role) {
  const sheet = getSessionsSheet();
  // Clear out expired sessions
  const rows = sheet.getDataRange().getValues();
  const now = new Date();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (!(rows[i][3] instanceof Date) || rows[i][3] < now) sheet.deleteRow(i + 1);
  }
  const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, "");
  sheet.appendRow([token, name, role, new Date(now.getTime() + SESSION_HOURS * 3600 * 1000)]);
  return token;
}

function getSession(token) {
  if (!token) return null;
  const rows = getSessionsSheet().getDataRange().getValues();
  const row = rows.find((r, i) => i > 0 && r[0] === token);
  if (!row || !(row[3] instanceof Date) || row[3] < new Date()) return null;
  return { name: String(row[1]), role: String(row[2]) };
}

function logout(data) {
  const sheet = getSessionsSheet();
  const rows = sheet.getDataRange().getValues();
  const index = rows.findIndex((r, i) => i > 0 && r[0] === data.token);
  if (index > 0) sheet.deleteRow(index + 1);
  return { status: "success" };
}

// Log in with mail ID (older accounts can still use their name)
function login(data) {
  const rows = getUsersSheet().getDataRange().getValues().slice(1);
  const id = String(data.email || data.name || "").trim().toLowerCase();
  const hashed = hashPassword(data.password || "");
  const user = rows.find(r =>
    (String(r[2]).trim().toLowerCase() === id || String(r[0]).trim().toLowerCase() === id) && r[3] === hashed);
  if (!user) return { status: "error", message: "Mail ID or password is incorrect." };

  const role = String(user[5] || "Employee").trim().toLowerCase() === "admin" ? "Admin" : "Employee";
  const name = String(user[0]);
  return {
    status: "success", name: name, role: role,
    email: String(user[2]), number: String(user[1]).replace(/^'/, ""),
    token: createSession(name, role)
  };
}

// =============================================================
// ADMIN: employees + assigned tasks
// =============================================================
function getEmployees(data) {
  const rows = getUsersSheet().getDataRange().getValues().slice(1);
  const me = data.name.toLowerCase();
  const people = rows
    .filter(r => r[0] && String(r[0]).toLowerCase() !== me)
    .map(r => ({ name: String(r[0]), role: String(r[5] || "Employee") }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { status: "success", employees: people };
}

function assignTask(data) {
  const t = data.task;
  const error = validateTask(t);
  if (error) return { status: "error", message: error };

  const users = getUsersSheet().getDataRange().getValues().slice(1);
  const person = users.find(r => String(r[0]).toLowerCase() === String(data.assignee || "").toLowerCase());
  if (!person) return { status: "error", message: "Choose an employee to assign this task to." };

  const sheet = getTasksSheet();
  const id = nextTaskId(sheet);
  const now = new Date();
  sheet.appendRow([
    id, String(person[0]), clean(t.title), clean(t.description), clean(t.category),
    t.priority, t.status, t.startDate, t.dueDate || "",
    t.status === "Completed" ? todayStr() : "",
    clean(t.remarks), now, now, data.name
  ]);
  return { status: "success", id: id, assignee: String(person[0]) };
}

function getAssignedTasks(data) {
  const rows = getTasksSheet().getDataRange().getValues().slice(1);
  const me = data.name.toLowerCase();
  return { status: "success",
           tasks: rows.filter(r => r[0] && String(r[13] || "").toLowerCase() === me).map(rowToTask) };
}

// Who may do what with a task row
function taskAccess(row, name) {
  const me = String(name).toLowerCase();
  const owner = String(row[1]).toLowerCase() === me;
  const assignedBy = String(row[13] || "");
  const isAssigner = assignedBy && assignedBy.toLowerCase() === me;
  return {
    full: isAssigner || (owner && !assignedBy),     // edit everything + delete
    statusOnly: owner && assignedBy && !isAssigner, // assigned to me by someone else
    assignedBy: assignedBy
  };
}

function getTasks(data) {
  const rows = getTasksSheet().getDataRange().getValues().slice(1);
  const me = String(data.name || "").toLowerCase();
  const tasks = rows.filter(r => r[0] && String(r[1]).toLowerCase() === me).map(rowToTask);
  return { status: "success", tasks: tasks };
}

function addTask(data) {
  const t = data.task;
  const error = validateTask(t);
  if (error) return { status: "error", message: error };

  const sheet = getTasksSheet();
  const id = nextTaskId(sheet);
  const now = new Date();
  sheet.appendRow([
    id, clean(data.name), clean(t.title), clean(t.description), clean(t.category),
    t.priority, t.status, t.startDate, t.dueDate || "",
    t.status === "Completed" ? todayStr() : "",
    clean(t.remarks), now, now, ""
  ]);
  return { status: "success", id: id };
}

function updateTask(data) {
  const t = data.task;
  const error = validateTask(t);
  if (error) return { status: "error", message: error };

  const sheet = getTasksSheet();
  const rows = sheet.getDataRange().getValues();
  const index = rows.findIndex((r, i) => i > 0 && String(r[0]) === String(data.id));
  if (index === -1) return { status: "error", message: "Task " + data.id + " was not found in the sheet." };

  const row = rows[index];
  const access = taskAccess(row, data.name);
  if (!access.full && !access.statusOnly)
    return { status: "error", message: "You can only update your own tasks." };

  // Assigned tasks: the employee can change only the status and remarks
  if (access.statusOnly) {
    t.title = String(row[2]); t.description = String(row[3]); t.category = String(row[4]);
    t.priority = String(row[5]); t.startDate = fmt(row[7], "yyyy-MM-dd"); t.dueDate = fmt(row[8], "yyyy-MM-dd");
  }

  // Keep the original completed date; set it when first completed; clear it if reopened
  let completed = "";
  if (t.status === "Completed") completed = row[9] ? fmt(row[9], "yyyy-MM-dd") : todayStr();

  // Columns C (Task Title) to M (Last Updated)
  sheet.getRange(index + 1, 3, 1, 11).setValues([[
    clean(t.title), clean(t.description), clean(t.category), t.priority, t.status,
    t.startDate, t.dueDate || "", completed, clean(t.remarks), row[11], new Date()
  ]]);
  return { status: "success", id: data.id };
}

function deleteTask(data) {
  const sheet = getTasksSheet();
  const rows = sheet.getDataRange().getValues();
  const index = rows.findIndex((r, i) => i > 0 && String(r[0]) === String(data.id));
  if (index === -1) return { status: "error", message: "Task " + data.id + " was not found. It may already be deleted." };
  const access = taskAccess(rows[index], data.name);
  if (access.statusOnly)
    return { status: "error", message: "This task was assigned by " + access.assignedBy + ". Only they can delete it." };
  if (!access.full) return { status: "error", message: "You can only delete your own tasks." };
  sheet.deleteRow(index + 1);
  return { status: "success", id: data.id };
}

// =============================================================
// REMINDERS
// =============================================================
const REMINDERS_SHEET = "Reminders";
const REMINDER_HEADERS = [
  "Reminder ID", "Username", "Description", "Priority", "Category",
  "1st Reminder", "2nd Reminder", "Final Reminder", "Status",
  "Times Extended", "Original Final Date", "Closed On", "Closed On Time",
  "Notes", "Created On", "Last Updated"
];
const R = { id: 0, user: 1, desc: 2, prio: 3, cat: 4, first: 5, second: 6, final: 7, status: 8,
            count: 9, origFinal: 10, closedOn: 11, onTime: 12, notes: 13, created: 14, updated: 15 };

function getRemindersSheet() {
  let sheet = book().getSheetByName(REMINDERS_SHEET);
  if (!sheet) {
    sheet = book().insertSheet(REMINDERS_SHEET);
    sheet.appendRow(REMINDER_HEADERS);
    styleHeader(sheet, REMINDER_HEADERS.length);
    sheet.getRange("D2:D").setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(PRIORITIES, true).build());
    sheet.getRange("I2:I").setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(["Open", "Extended", "Closed"], true).build());
  }
  return sheet;
}

function nextId(sheet, prefix) {
  const ids = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat() : [];
  const max = ids.reduce((m, id) => Math.max(m, parseInt(String(id).replace(/\D/g, ""), 10) || 0), 0);
  return prefix + "-" + String(max + 1).padStart(4, "0");
}

function rowToReminder(r) {
  const d = (v) => fmt(v, "yyyy-MM-dd");
  return {
    id: String(r[R.id]), username: String(r[R.user]), description: String(r[R.desc]),
    priority: String(r[R.prio]), category: String(r[R.cat]),
    first: d(r[R.first]), second: d(r[R.second]), final: d(r[R.final]),
    status: String(r[R.status]), extendedCount: Number(r[R.count]) || 0,
    originalFinal: d(r[R.origFinal]), closedOn: d(r[R.closedOn]), closedOnTime: String(r[R.onTime]),
    notes: String(r[R.notes]),
    createdOn: fmt(r[R.created], "yyyy-MM-dd HH:mm"), updatedOn: fmt(r[R.updated], "yyyy-MM-dd HH:mm")
  };
}

function validateReminder(r) {
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!r || !String(r.description || "").trim()) return "Reminder description is required.";
  if (PRIORITIES.indexOf(r.priority) === -1) return "Priority must be High, Medium or Low.";
  if (!String(r.category || "").trim()) return "Choose a category.";
  if (!isDate(r.first)) return "1st reminder date is required.";
  if (!isDate(r.final)) return "Final reminder date is required.";
  if (r.second && !isDate(r.second)) return "2nd reminder date is not valid.";
  if (r.second && r.second < r.first) return "2nd reminder can't be before the 1st reminder.";
  if (r.final < (r.second || r.first)) return "Final reminder can't be before the earlier reminders.";
  return "";
}

// Finds a reminder row that belongs to this user
function findReminder(sheet, id, name) {
  const rows = sheet.getDataRange().getValues();
  const index = rows.findIndex((r, i) => i > 0 && String(r[R.id]) === String(id));
  if (index === -1) return { error: "Reminder " + id + " was not found. It may have been deleted." };
  if (String(rows[index][R.user]).toLowerCase() !== String(name).toLowerCase())
    return { error: "You can only change your own reminders." };
  return { rowNumber: index + 1, row: rows[index] };
}

function writeReminderRow(sheet, rowNumber, row) {
  row[R.updated] = new Date();
  sheet.getRange(rowNumber, 1, 1, REMINDER_HEADERS.length).setValues([row]);
}

function getReminders(data) {
  const rows = getRemindersSheet().getDataRange().getValues().slice(1);
  const me = String(data.name || "").toLowerCase();
  return { status: "success",
           reminders: rows.filter(r => r[0] && String(r[R.user]).toLowerCase() === me).map(rowToReminder) };
}

function addReminder(data) {
  const r = data.reminder;
  const error = validateReminder(r);
  if (error) return { status: "error", message: error };
  const sheet = getRemindersSheet();
  const id = nextId(sheet, "RMD");
  const now = new Date();
  sheet.appendRow([
    id, clean(data.name), clean(r.description), r.priority, clean(r.category),
    r.first, r.second || "", r.final, "Open", 0, "", "", "", clean(r.notes), now, now
  ]);
  return { status: "success", id: id };
}

function updateReminder(data) {
  const r = data.reminder;
  const error = validateReminder(r);
  if (error) return { status: "error", message: error };
  const sheet = getRemindersSheet();
  const found = findReminder(sheet, data.id, data.name);
  if (found.error) return { status: "error", message: found.error };
  const row = found.row;
  row[R.desc] = clean(r.description); row[R.prio] = r.priority; row[R.cat] = clean(r.category);
  row[R.first] = r.first; row[R.second] = r.second || ""; row[R.final] = r.final; row[R.notes] = clean(r.notes);
  writeReminderRow(sheet, found.rowNumber, row);
  return { status: "success", id: data.id };
}

function closeReminder(data) {
  const sheet = getRemindersSheet();
  const found = findReminder(sheet, data.id, data.name);
  if (found.error) return { status: "error", message: found.error };
  const row = found.row;
  if (row[R.status] === "Closed") return { status: "error", message: "This reminder is already closed." };
  const today = todayStr();
  const onTime = today <= fmt(row[R.final], "yyyy-MM-dd");
  row[R.status] = "Closed"; row[R.closedOn] = today; row[R.onTime] = onTime ? "Yes" : "No";
  writeReminderRow(sheet, found.rowNumber, row);
  return { status: "success", id: data.id, onTime: onTime };
}

function extendReminder(data) {
  const sheet = getRemindersSheet();
  const found = findReminder(sheet, data.id, data.name);
  if (found.error) return { status: "error", message: found.error };
  const row = found.row;
  const currentFinal = fmt(row[R.final], "yyyy-MM-dd");
  if (row[R.status] === "Closed") return { status: "error", message: "A closed reminder can't be extended." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.newFinal)) return { status: "error", message: "Choose the new final reminder date." };
  if (data.newFinal <= currentFinal) return { status: "error", message: "The new date must be after the current final reminder." };
  if (data.newFinal < todayStr()) return { status: "error", message: "The new date can't be in the past." };

  if (!row[R.origFinal]) row[R.origFinal] = currentFinal;
  row[R.final] = data.newFinal;
  row[R.status] = "Extended";
  row[R.count] = (Number(row[R.count]) || 0) + 1;
  const newDMY = data.newFinal.split("-").reverse().join("/");
  const line = "Extended to " + newDMY + (data.note ? ": " + String(data.note).trim() : "");
  row[R.notes] = clean(row[R.notes] ? row[R.notes] + "\n" + line : line);
  writeReminderRow(sheet, found.rowNumber, row);
  return { status: "success", id: data.id };
}

function deleteReminder(data) {
  const sheet = getRemindersSheet();
  const found = findReminder(sheet, data.id, data.name);
  if (found.error) return { status: "error", message: found.error };
  sheet.deleteRow(found.rowNumber);
  return { status: "success", id: data.id };
}

// =============================================================
// MY CALENDAR (Plan vs Actual, 9:00 AM – 6:00 PM)
// =============================================================
const CALENDAR_SHEET = "Calendar";
const CAL_HEADERS = [
  "Entry ID", "Username", "Date", "Day", "Type", "Start Time", "End Time", "Hours",
  "Activity", "Color", "Notes", "Created On", "Last Updated"
];
const CAL_TYPES = ["Plan", "Actual"];
const CAL_DAY_START = 9 * 60, CAL_DAY_END = 18 * 60;
const C = { id: 0, user: 1, date: 2, day: 3, type: 4, start: 5, end: 6, hours: 7,
            activity: 8, color: 9, notes: 10, created: 11, updated: 12 };

function getCalendarSheet() {
  let sheet = book().getSheetByName(CALENDAR_SHEET);
  if (!sheet) {
    sheet = book().insertSheet(CALENDAR_SHEET);
    sheet.appendRow(CAL_HEADERS);
    styleHeader(sheet, CAL_HEADERS.length);
    sheet.getRange("E2:E").setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(CAL_TYPES, true).build());
  }
  return sheet;
}

// Times are stored as text ("09:30") so the sheet doesn't turn them into dates
function calTime(v) {
  if (v instanceof Date) return ("0" + v.getHours()).slice(-2) + ":" + ("0" + v.getMinutes()).slice(-2);
  const m = String(v || "").replace(/^'/, "").match(/^(\d{1,2}):(\d{2})/);
  return m ? ("0" + m[1]).slice(-2) + ":" + m[2] : "";
}
function calMin(t) { const p = String(t).split(":"); return Number(p[0]) * 60 + Number(p[1]); }
function calDayName(iso) {
  const p = iso.split("-").map(Number);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(p[0], p[1] - 1, p[2]).getDay()];
}

function rowToEntry(r) {
  return {
    id: String(r[C.id]), date: fmt(r[C.date], "yyyy-MM-dd"), type: String(r[C.type]),
    start: calTime(r[C.start]), end: calTime(r[C.end]),
    activity: String(r[C.activity]), color: String(r[C.color] || "#ffffff"), notes: String(r[C.notes])
  };
}

function validateEntry(e, needType) {
  const isTime = (s) => /^\d{2}:\d{2}$/.test(s);
  if (!e || !String(e.activity || "").trim()) return "Activity is required.";
  if (String(e.activity).length > 200) return "Keep the activity under 200 characters.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return "Choose a date.";
  if (needType && CAL_TYPES.indexOf(e.type) === -1) return "Type must be Plan or Actual.";
  if (!isTime(e.start) || !isTime(e.end)) return "Choose a start and end time.";
  const s = calMin(e.start), en = calMin(e.end);
  if (s < CAL_DAY_START || en > CAL_DAY_END) return "Times must be between 9:00 AM and 6:00 PM.";
  if (en <= s) return "End time must be after the start time.";
  if (e.color && !/^#[0-9a-fA-F]{6}$/.test(e.color)) return "Colour is not valid.";
  return "";
}

function entryRow(id, name, date, type, e, created, now) {
  return [id, clean(name), date, calDayName(date), type, "'" + e.start, "'" + e.end,
          (calMin(e.end) - calMin(e.start)) / 60, clean(e.activity), e.color || "#ffffff",
          clean(e.notes), created, now];
}

function findEntry(sheet, id, name) {
  const rows = sheet.getDataRange().getValues();
  const index = rows.findIndex((r, i) => i > 0 && String(r[C.id]) === String(id));
  if (index === -1) return { error: "Entry " + id + " was not found. It may have been deleted." };
  if (String(rows[index][C.user]).toLowerCase() !== String(name).toLowerCase())
    return { error: "You can only change your own calendar." };
  return { rowNumber: index + 1, row: rows[index] };
}

function getCalendar(data) {
  const from = String(data.from || ""), to = String(data.to || "");
  const me = String(data.name || "").toLowerCase();
  const rows = getCalendarSheet().getDataRange().getValues().slice(1);
  const entries = rows
    .filter(r => r[0] && String(r[C.user]).toLowerCase() === me)
    .map(rowToEntry)
    .filter(e => (!from || e.date >= from) && (!to || e.date <= to));
  return { status: "success", entries: entries };
}

// One entry, optionally on several dates and as Plan + Actual
function addCalendarEntry(data) {
  const e = data.entry || {};
  const dates = Array.isArray(data.dates) && data.dates.length ? data.dates : [e.date];
  const types = Array.isArray(data.types) && data.types.length ? data.types : [e.type];
  if (dates.length > 7) return { status: "error", message: "You can add to at most 7 days at once." };
  for (const d of dates) {
    const error = validateEntry(Object.assign({}, e, { date: d }), false);
    if (error) return { status: "error", message: error };
  }
  if (types.some(t => CAL_TYPES.indexOf(t) === -1)) return { status: "error", message: "Type must be Plan or Actual." };

  const sheet = getCalendarSheet();
  let next = parseInt(nextId(sheet, "CAL").replace(/\D/g, ""), 10);
  const now = new Date();
  const rows = [];
  dates.filter((d, i) => dates.indexOf(d) === i).forEach(d => types.forEach(t => {
    rows.push(entryRow("CAL-" + String(next++).padStart(4, "0"), data.name, d, t, e, now, now));
  }));
  const start = sheet.getLastRow() + 1;
  sheet.getRange(start, 1, rows.length, CAL_HEADERS.length).setValues(rows);
  sheet.getRange(start, C.activity + 1, rows.length, 1).setBackgrounds(rows.map(r => [r[C.color]]));
  return { status: "success", count: rows.length };
}

function updateCalendarEntry(data) {
  const e = data.entry;
  const error = validateEntry(e, true);
  if (error) return { status: "error", message: error };
  const sheet = getCalendarSheet();
  const found = findEntry(sheet, data.id, data.name);
  if (found.error) return { status: "error", message: found.error };
  const row = entryRow(found.row[C.id], found.row[C.user], e.date, e.type, e, found.row[C.created], new Date());
  sheet.getRange(found.rowNumber, 1, 1, CAL_HEADERS.length).setValues([row]);
  sheet.getRange(found.rowNumber, C.activity + 1).setBackground(row[C.color]);
  return { status: "success", id: data.id };
}

function deleteCalendarEntry(data) {
  const sheet = getCalendarSheet();
  const found = findEntry(sheet, data.id, data.name);
  if (found.error) return { status: "error", message: found.error };
  sheet.deleteRow(found.rowNumber);
  return { status: "success", id: data.id };
}

// ---------- Entry point ----------
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const data = JSON.parse(e.postData.contents);
    const writes = ["signup", "login", "logout", "addTask", "updateTask", "deleteTask", "assignTask",
                    "addReminder", "updateReminder", "closeReminder", "extendReminder", "deleteReminder",
                    "addCalendarEntry", "updateCalendarEntry", "deleteCalendarEntry"];
    if (writes.indexOf(data.action) !== -1) lock.waitLock(10000);

    // No login needed for these two
    if (data.action === "signup") return reply(signup(data));
    if (data.action === "login")  return reply(login(data));

    // Everything else: the user comes from the login token, never from the page
    const session = getSession(data.token);
    if (!session) return reply({ status: "error", code: "AUTH", message: "Your session has expired. Please log in again." });
    data.name = session.name;
    data.role = session.role;

    const adminOnly = ["getEmployees", "assignTask", "getAssignedTasks"];
    if (adminOnly.indexOf(data.action) !== -1 && data.role !== "Admin")
      return reply({ status: "error", message: "Only admins can do this." });

    switch (data.action) {
      case "logout":           return reply(logout(data));
      case "getTasks":         return reply(getTasks(data));
      case "addTask":          return reply(addTask(data));
      case "updateTask":       return reply(updateTask(data));
      case "deleteTask":       return reply(deleteTask(data));
      case "getEmployees":     return reply(getEmployees(data));
      case "assignTask":       return reply(assignTask(data));
      case "getAssignedTasks": return reply(getAssignedTasks(data));
      case "getReminders":     return reply(getReminders(data));
      case "addReminder":      return reply(addReminder(data));
      case "updateReminder":   return reply(updateReminder(data));
      case "closeReminder":    return reply(closeReminder(data));
      case "extendReminder":   return reply(extendReminder(data));
      case "deleteReminder":   return reply(deleteReminder(data));
      case "getCalendar":         return reply(getCalendar(data));
      case "addCalendarEntry":    return reply(addCalendarEntry(data));
      case "updateCalendarEntry": return reply(updateCalendarEntry(data));
      case "deleteCalendarEntry": return reply(deleteCalendarEntry(data));
      default:                 return reply({ status: "error", message: "Unknown action." });
    }
  } catch (err) {
    return reply({ status: "error", message: "Server error: " + err.message });
  } finally {
    lock.releaseLock();
  }
}
