// =============================================================
// Supabase connection (replaces Google Apps Script / Code.gs)
// Every page calls callSheet({ action, ... }) exactly as before;
// this file answers each action from the Supabase database.
// Load order on every page: supabase library → api.js → script.js
// =============================================================
(function () {
  const SUPABASE_URL = "https://ywexhvgacwwcrpxuwslq.supabase.co";
  const SUPABASE_KEY = "sb_publishable_6arT_8LP3flGzSN7-_Lr8A_gKMSajav"; // public key, safe in the website

  // Login lasts for this browser tab, like before
  const db = window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      })
    : null;

  const STATUSES = ["Not Started", "Pending", "Ongoing", "Hold", "Completed", "Cancelled"];
  const PRIORITIES = ["High", "Medium", "Low"];
  const CAL_TYPES = ["Plan", "Actual"];

  class AuthError extends Error {}
  const fail = (message) => ({ status: "error", message });
  const ok = (extra) => Object.assign({ status: "success" }, extra);

  // ---------- Small helpers ----------
  const pad = (n) => String(n).padStart(4, "0");
  const numOf = (id) => parseInt(String(id).replace(/\D/g, ""), 10);
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
  const two = (n) => String(n).padStart(2, "0");
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`; };
  const dmy = (iso) => iso.split("-").reverse().join("/");
  const stamp = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
  };
  const text = (v) => String(v ?? "").trim();

  async function myId() {
    const { data } = await db.auth.getSession();
    if (!data.session) throw new AuthError();
    return data.session.user.id;
  }

  // Turn database errors into plain messages
  function check(error) {
    if (!error) return;
    if (error.code === "PGRST301" || error.code === "PGRST303" || /jwt/i.test(error.message || "")) throw new AuthError();
    if (error.code === "42501") throw new Error("You don't have permission to do that.");
    if (error.code === "23514") throw new Error("Some values aren't allowed. Please check the form and try again.");
    throw new Error(error.message || "Something went wrong. Please try again.");
  }

  // =============================================================
  // LOGIN / SIGNUP
  // =============================================================
  async function signup(d) {
    const { data, error } = await db.auth.signUp({
      email: text(d.email).toLowerCase(),
      password: d.password,
      options: { data: { name: text(d.name), number: text(d.number) } },
    });
    if (error) {
      if (/already registered|already exists/i.test(error.message)) return fail("That mail ID already has an account. Log in instead.");
      if (/rate limit/i.test(error.message)) return fail("Too many sign-ups right now. Please wait a few minutes and try again.");
      return fail(error.message);
    }
    // With email confirmation on, an existing mail ID comes back with no identities
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0)
      return fail("That mail ID already has an account. Log in instead.");
    if (data.session) { await db.auth.signOut(); return ok(); }   // log in from the login page, like before
    return ok({ confirm: true });                                  // must confirm the mail ID first
  }

  async function login(d) {
    const { data, error } = await db.auth.signInWithPassword({ email: text(d.email).toLowerCase(), password: d.password || "" });
    if (error) {
      if (/invalid login credentials/i.test(error.message)) return fail("Mail ID or password is incorrect.");
      if (/not confirmed/i.test(error.message)) return fail("Please confirm your mail ID first. Check your inbox for the confirmation mail.");
      return fail(error.message);
    }
    const { data: p, error: pErr } = await db.from("profiles").select("name, role, number, email").eq("id", data.user.id).single();
    if (pErr) { await db.auth.signOut(); check(pErr); }
    return ok({ name: p.name, role: p.role, email: p.email, number: p.number || "", token: "supabase" });
  }

  async function logout() {
    await db.auth.signOut();
    return ok();
  }

  // =============================================================
  // TASKS
  // =============================================================
  const TASK_COLS = "id, task_no, user_id, assigned_by, title, description, category, priority, status, " +
    "start_date, due_date, completed_date, remarks, created_at, updated_at, " +
    "owner:profiles!tasks_user_id_fkey(name), assigner:profiles!tasks_assigned_by_fkey(name)";

  function toTask(r) {
    return {
      id: "TSK-" + pad(r.task_no),
      key: "row:" + r.id,                       // unique across everyone (used on the Assigned Tasks page)
      username: r.owner ? r.owner.name : "",
      title: r.title, description: r.description, category: r.category,
      priority: r.priority, status: r.status,
      startDate: r.start_date || "", dueDate: r.due_date || "", completedDate: r.completed_date || "",
      remarks: r.remarks,
      createdOn: stamp(r.created_at), updatedOn: stamp(r.updated_at),
      assignedBy: r.assigner ? r.assigner.name : "",
    };
  }

  function validateTask(t) {
    if (!t || !text(t.title)) return "Task title is required.";
    if (!isDate(t.startDate)) return "Start date is required.";
    if (t.dueDate && !isDate(t.dueDate)) return "Due date is not valid.";
    if (t.dueDate && t.dueDate < t.startDate) return "Due date can't be before the start date.";
    if (STATUSES.indexOf(t.status) === -1) return "Status must be one of: " + STATUSES.join(", ") + ".";
    if (PRIORITIES.indexOf(t.priority) === -1) return "Priority must be High, Medium or Low.";
    return "";
  }

  const taskFields = (t, completed) => ({
    title: text(t.title), description: text(t.description), category: text(t.category),
    priority: t.priority, status: t.status, start_date: t.startDate, due_date: t.dueDate || null,
    completed_date: completed, remarks: text(t.remarks),
  });

  // "TSK-0003" = my own task no. 3; "row:57" = a specific task (Assigned Tasks page)
  async function findTask(id, uid) {
    let q = db.from("tasks").select(TASK_COLS);
    q = String(id).startsWith("row:") ? q.eq("id", numOf(id)) : q.eq("user_id", uid).eq("task_no", numOf(id));
    const { data, error } = await q.maybeSingle();
    check(error);
    return data;
  }

  function taskAccess(r, uid) {
    const owner = r.user_id === uid;
    const isAssigner = Boolean(r.assigned_by) && r.assigned_by === uid;
    return {
      full: isAssigner || (owner && !r.assigned_by),
      statusOnly: owner && Boolean(r.assigned_by) && !isAssigner,
    };
  }

  async function getTasks() {
    const uid = await myId();
    const { data, error } = await db.from("tasks").select(TASK_COLS).eq("user_id", uid).order("task_no");
    check(error);
    return ok({ tasks: data.map(toTask) });
  }

  async function addTask(d) {
    const t = d.task;
    const err = validateTask(t);
    if (err) return fail(err);
    const uid = await myId();
    const { data, error } = await db.from("tasks")
      .insert(Object.assign({ user_id: uid }, taskFields(t, t.status === "Completed" ? today() : null)))
      .select("task_no").single();
    check(error);
    return ok({ id: "TSK-" + pad(data.task_no) });
  }

  async function updateTask(d) {
    const t = d.task;
    const err = validateTask(t);
    if (err) return fail(err);
    const uid = await myId();
    const row = await findTask(d.id, uid);
    if (!row) return fail("Task " + d.id + " was not found. It may have been deleted.");
    const access = taskAccess(row, uid);
    if (!access.full && !access.statusOnly) return fail("You can only update your own tasks.");

    // Keep the original completed date; set it when first completed; clear it if reopened
    const completed = t.status === "Completed" ? (row.completed_date || today()) : null;
    const changes = access.statusOnly
      ? { status: t.status, remarks: text(t.remarks), completed_date: completed }  // assigned to me: status + remarks only
      : taskFields(t, completed);
    const { error } = await db.from("tasks").update(changes).eq("id", row.id);
    check(error);
    return ok({ id: "TSK-" + pad(row.task_no) });
  }

  async function deleteTask(d) {
    const uid = await myId();
    const row = await findTask(d.id, uid);
    if (!row) return fail("Task " + d.id + " was not found. It may already be deleted.");
    const access = taskAccess(row, uid);
    if (access.statusOnly)
      return fail("This task was assigned by " + (row.assigner ? row.assigner.name : "your Admin") + ". Only they can delete it.");
    if (!access.full) return fail("You can only delete your own tasks.");
    const { error } = await db.from("tasks").delete().eq("id", row.id);
    check(error);
    return ok({ id: "TSK-" + pad(row.task_no) });
  }

  // ---------- Admin: employees + assigned tasks ----------
  let employeeIds = {};   // label shown in the dropdown → user id

  async function getEmployees() {
    const uid = await myId();
    const { data, error } = await db.from("profiles").select("id, name, email, role").neq("id", uid).order("name");
    check(error);
    // Same name twice? Add the mail ID so the right person is picked
    const counts = {};
    data.forEach((p) => (counts[p.name.toLowerCase()] = (counts[p.name.toLowerCase()] || 0) + 1));
    employeeIds = {};
    const employees = data.map((p) => {
      const label = counts[p.name.toLowerCase()] > 1 ? `${p.name} (${p.email})` : p.name;
      employeeIds[label] = p.id;
      return { name: label, role: p.role };
    });
    return ok({ employees });
  }

  async function assignTask(d) {
    const t = d.task;
    const err = validateTask(t);
    if (err) return fail(err);
    const uid = await myId();
    if (!employeeIds[d.assignee]) await getEmployees();
    const assigneeId = employeeIds[d.assignee];
    if (!assigneeId) return fail("Choose an employee to assign this task to.");
    const { data, error } = await db.from("tasks")
      .insert(Object.assign({ user_id: assigneeId, assigned_by: uid }, taskFields(t, t.status === "Completed" ? today() : null)))
      .select("task_no").single();
    check(error);
    return ok({ id: "TSK-" + pad(data.task_no), assignee: d.assignee });
  }

  async function getAssignedTasks() {
    const uid = await myId();
    const { data, error } = await db.from("tasks").select(TASK_COLS).eq("assigned_by", uid).order("created_at");
    check(error);
    return ok({ tasks: data.map(toTask) });
  }

  // =============================================================
  // REMINDERS
  // =============================================================
  const REM_COLS = "id, reminder_no, description, priority, category, first_reminder, second_reminder, final_reminder, " +
    "status, times_extended, original_final_date, closed_on, closed_on_time, notes, created_at, updated_at";

  function toReminder(r) {
    return {
      id: "RMD-" + pad(r.reminder_no),
      username: sessionStorage.getItem("username") || "",
      description: r.description, priority: r.priority, category: r.category,
      first: r.first_reminder || "", second: r.second_reminder || "", final: r.final_reminder || "",
      status: r.status, extendedCount: r.times_extended || 0,
      originalFinal: r.original_final_date || "", closedOn: r.closed_on || "",
      closedOnTime: r.closed_on_time === true ? "Yes" : r.closed_on_time === false ? "No" : "",
      notes: r.notes, createdOn: stamp(r.created_at), updatedOn: stamp(r.updated_at),
    };
  }

  function validateReminder(r) {
    if (!r || !text(r.description)) return "Reminder description is required.";
    if (PRIORITIES.indexOf(r.priority) === -1) return "Priority must be High, Medium or Low.";
    if (!text(r.category)) return "Choose a category.";
    if (!isDate(r.first)) return "1st reminder date is required.";
    if (!isDate(r.final)) return "Final reminder date is required.";
    if (r.second && !isDate(r.second)) return "2nd reminder date is not valid.";
    if (r.second && r.second < r.first) return "2nd reminder can't be before the 1st reminder.";
    if (r.final < (r.second || r.first)) return "Final reminder can't be before the earlier reminders.";
    return "";
  }

  async function findReminder(id, uid) {
    const { data, error } = await db.from("reminders").select(REM_COLS)
      .eq("user_id", uid).eq("reminder_no", numOf(id)).maybeSingle();
    check(error);
    return data;
  }

  async function getReminders() {
    const uid = await myId();
    const { data, error } = await db.from("reminders").select(REM_COLS).eq("user_id", uid).order("reminder_no");
    check(error);
    return ok({ reminders: data.map(toReminder) });
  }

  async function addReminder(d) {
    const r = d.reminder;
    const err = validateReminder(r);
    if (err) return fail(err);
    const uid = await myId();
    const { data, error } = await db.from("reminders").insert({
      user_id: uid, description: text(r.description), priority: r.priority, category: text(r.category),
      first_reminder: r.first, second_reminder: r.second || null, final_reminder: r.final, notes: text(r.notes),
    }).select("reminder_no").single();
    check(error);
    return ok({ id: "RMD-" + pad(data.reminder_no) });
  }

  async function changeReminder(row, changes) {
    const { error } = await db.from("reminders").update(changes).eq("id", row.id);
    check(error);
  }

  async function updateReminder(d) {
    const r = d.reminder;
    const err = validateReminder(r);
    if (err) return fail(err);
    const row = await findReminder(d.id, await myId());
    if (!row) return fail("Reminder " + d.id + " was not found. It may have been deleted.");
    await changeReminder(row, {
      description: text(r.description), priority: r.priority, category: text(r.category),
      first_reminder: r.first, second_reminder: r.second || null, final_reminder: r.final, notes: text(r.notes),
    });
    return ok({ id: d.id });
  }

  async function closeReminder(d) {
    const row = await findReminder(d.id, await myId());
    if (!row) return fail("Reminder " + d.id + " was not found. It may have been deleted.");
    if (row.status === "Closed") return fail("This reminder is already closed.");
    const onTime = today() <= row.final_reminder;
    await changeReminder(row, { status: "Closed", closed_on: today(), closed_on_time: onTime });
    return ok({ id: d.id, onTime });
  }

  async function extendReminder(d) {
    const row = await findReminder(d.id, await myId());
    if (!row) return fail("Reminder " + d.id + " was not found. It may have been deleted.");
    if (row.status === "Closed") return fail("A closed reminder can't be extended.");
    if (!isDate(d.newFinal)) return fail("Choose the new final reminder date.");
    if (d.newFinal <= row.final_reminder) return fail("The new date must be after the current final reminder.");
    if (d.newFinal < today()) return fail("The new date can't be in the past.");
    const line = "Extended to " + dmy(d.newFinal) + (text(d.note) ? ": " + text(d.note) : "");
    await changeReminder(row, {
      original_final_date: row.original_final_date || row.final_reminder,
      final_reminder: d.newFinal,
      status: "Extended",
      times_extended: (row.times_extended || 0) + 1,
      notes: row.notes ? row.notes + "\n" + line : line,
    });
    return ok({ id: d.id });
  }

  async function deleteReminder(d) {
    const row = await findReminder(d.id, await myId());
    if (!row) return fail("Reminder " + d.id + " was not found. It may have been deleted.");
    const { error } = await db.from("reminders").delete().eq("id", row.id);
    check(error);
    return ok({ id: d.id });
  }

  // =============================================================
  // MY CALENDAR
  // =============================================================
  const toMin = (t) => { const p = String(t).split(":"); return Number(p[0]) * 60 + Number(p[1]); };

  function validateEntry(e, needType) {
    if (!e || !text(e.activity)) return "Activity is required.";
    if (text(e.activity).length > 200) return "Keep the activity under 200 characters.";
    if (!isDate(e.date)) return "Choose a date.";
    if (needType && CAL_TYPES.indexOf(e.type) === -1) return "Type must be Plan or Actual.";
    if (!/^\d{2}:\d{2}$/.test(e.start || "") || !/^\d{2}:\d{2}$/.test(e.end || "")) return "Choose a start and end time.";
    if (toMin(e.start) < 540 || toMin(e.end) > 1080) return "Times must be between 9:00 AM and 6:00 PM.";
    if (toMin(e.end) <= toMin(e.start)) return "End time must be after the start time.";
    if (e.color && !/^#[0-9a-fA-F]{6}$/.test(e.color)) return "Colour is not valid.";
    return "";
  }

  const entryFields = (e) => ({
    start_time: e.start, end_time: e.end, activity: text(e.activity),
    color: e.color || "#ffffff", notes: text(e.notes),
  });

  async function getCalendar(d) {
    const uid = await myId();
    let q = db.from("calendar_entries").select("id, entry_date, type, start_time, end_time, activity, color, notes").eq("user_id", uid);
    if (d.from) q = q.gte("entry_date", d.from);
    if (d.to) q = q.lte("entry_date", d.to);
    const { data, error } = await q.order("entry_date").order("start_time");
    check(error);
    return ok({
      entries: data.map((r) => ({
        id: "CAL-" + r.id, date: r.entry_date, type: r.type,
        start: String(r.start_time).slice(0, 5), end: String(r.end_time).slice(0, 5),
        activity: r.activity, color: r.color, notes: r.notes,
      })),
    });
  }

  async function addCalendarEntry(d) {
    const e = d.entry || {};
    const dates = [...new Set(Array.isArray(d.dates) && d.dates.length ? d.dates : [e.date])];
    const types = Array.isArray(d.types) && d.types.length ? d.types : [e.type];
    if (dates.length > 7) return fail("You can add to at most 7 days at once.");
    for (const date of dates) {
      const err = validateEntry(Object.assign({}, e, { date }), false);
      if (err) return fail(err);
    }
    if (types.some((t) => CAL_TYPES.indexOf(t) === -1)) return fail("Type must be Plan or Actual.");
    const uid = await myId();
    const rows = [];
    dates.forEach((date) => types.forEach((type) =>
      rows.push(Object.assign({ user_id: uid, entry_date: date, type }, entryFields(e)))));
    const { error } = await db.from("calendar_entries").insert(rows);
    check(error);
    return ok({ count: rows.length });
  }

  async function updateCalendarEntry(d) {
    const e = d.entry;
    const err = validateEntry(e, true);
    if (err) return fail(err);
    const uid = await myId();
    const { data, error } = await db.from("calendar_entries")
      .update(Object.assign({ entry_date: e.date, type: e.type }, entryFields(e)))
      .eq("id", numOf(d.id)).eq("user_id", uid).select("id");
    check(error);
    if (!data.length) return fail("Entry " + d.id + " was not found. It may have been deleted.");
    return ok({ id: d.id });
  }

  async function deleteCalendarEntry(d) {
    const uid = await myId();
    const { data, error } = await db.from("calendar_entries").delete()
      .eq("id", numOf(d.id)).eq("user_id", uid).select("id");
    check(error);
    if (!data.length) return fail("Entry " + d.id + " was not found. It may have been deleted.");
    return ok({ id: d.id });
  }

  // =============================================================
  // The one function every page uses
  // =============================================================
  const ACTIONS = {
    signup, login, logout,
    getTasks, addTask, updateTask, deleteTask,
    getEmployees, assignTask, getAssignedTasks,
    getReminders, addReminder, updateReminder, closeReminder, extendReminder, deleteReminder,
    getCalendar, addCalendarEntry, updateCalendarEntry, deleteCalendarEntry,
  };

  window.callSheet = async function (data) {
    if (!db) throw new TypeError("The Supabase library didn't load.");
    const handler = ACTIONS[data.action];
    if (!handler) return fail("Unknown action: " + data.action);
    try {
      return await handler(data);
    } catch (err) {
      if (err instanceof AuthError) {
        // Session expired or missing: back to the login page
        sessionStorage.clear();
        window.location.replace("index.html?expired=1");
        return new Promise(() => {}); // stop the calling code here
      }
      if (/failed to fetch|networkerror|load failed/i.test(err.message || "")) throw new TypeError(err.message);
      throw err;
    }
  };
})();
