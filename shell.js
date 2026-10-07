// =============================================================
// Shared code for logged-in pages (Dashboard, Add Task, View & Edit Task)
// Load AFTER script.js
// =============================================================
const CURRENT_USER = sessionStorage.getItem("username");
const CURRENT_ROLE = sessionStorage.getItem("role") || "Employee";
const IS_ADMIN = CURRENT_ROLE === "Admin";
if (!CURRENT_USER || !sessionStorage.getItem("token")) window.location.replace("index.html"); // not logged in

// Admin-only menu items and pages
if (IS_ADMIN) document.body.classList.add("is-admin");
if (document.body.dataset.adminPage !== undefined && !IS_ADMIN) window.location.replace("home.html");
document.querySelectorAll("[data-role-label]").forEach((el) => (el.textContent = IS_ADMIN ? "Admin panel" : "Employee panel"));

const STATUS_LIST = ["Not Started", "Pending", "Ongoing", "Hold", "Completed", "Cancelled"];
const STATUS_COLORS = {
  "Not Started": "#8b93a7",
  Pending: "#e8890c",
  Ongoing: "#2b7de0",
  Hold: "#d9365a",
  Completed: "#1f9d55",
  Cancelled: "#4a4458",
};

// Username everywhere it's needed
document.querySelectorAll("[data-username]").forEach((el) => (el.textContent = CURRENT_USER || ""));
const avatarEl = document.getElementById("avatar");
if (avatarEl && CURRENT_USER) {
  avatarEl.textContent = CURRENT_USER.charAt(0).toUpperCase();
  avatarEl.title = CURRENT_USER;
}

// ---------- Profile menu (top-right avatar) ----------
const profile = document.getElementById("profile");
if (profile && CURRENT_USER) {
  const initial = CURRENT_USER.charAt(0).toUpperCase();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("pmAvatar", initial);
  set("pmName", CURRENT_USER);
  set("pmRole", CURRENT_ROLE);
  set("pmEmail", sessionStorage.getItem("email") || "–");
  set("pmNumber", sessionStorage.getItem("number") || "–");

  const btn = document.getElementById("avatar");
  const toggle = (open) => {
    profile.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", open);
  };
  btn.addEventListener("click", (e) => { e.stopPropagation(); toggle(!profile.classList.contains("open")); });
  document.addEventListener("click", (e) => { if (!profile.contains(e.target)) toggle(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggle(false); });
}

// ---------- Log out (profile menu) ----------
async function logOut() {
  try { await Promise.race([callSheet({ action: "logout" }), new Promise((r) => setTimeout(r, 1500))]); } catch (e) {}
  sessionStorage.clear();
  window.location.href = "index.html";
}
document.getElementById("menuLogout")?.addEventListener("click", logOut);

// Mobile menu
document.getElementById("menuBtn")?.addEventListener("click", () => document.body.classList.toggle("nav-open"));
document.getElementById("scrim")?.addEventListener("click", () => document.body.classList.remove("nav-open"));

// ---------- Date + text helpers ----------
function toISO(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function formatDMY(iso) {
  if (!iso) return "–";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function timeAgo(date) {
  if (!date) return "";
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  return mins < 1 ? "just now" : mins === 1 ? "1 min ago" : `${mins} min ago`;
}
function isOverdue(t) {
  return t.status !== "Completed" && t.status !== "Cancelled" && t.dueDate && t.dueDate < toISO(new Date());
}
function assignedChip(t) {
  return t.assignedBy ? `<span class="chip">Assigned by ${esc(t.assignedBy)}</span>` : "";
}
function isAssignedToMe(t) {
  return Boolean(t.assignedBy) && t.assignedBy.toLowerCase() !== String(CURRENT_USER).toLowerCase();
}
function statusBadge(status) {
  const slug = String(status || "").replace(/\s+/g, "-");
  return `<span class="badge st-${esc(slug)}">${esc(status)}</span>`;
}
function serverError(err) {
  return err instanceof TypeError
    ? "Could not reach the server. Check the SCRIPT_URL in script.js."
    : err.message;
}

// ---------- Load this user's tasks from the sheet ----------
async function fetchMyTasks() {
  const res = await callSheet({ action: "getTasks", name: CURRENT_USER });
  if (res.status !== "success") throw new Error(res.message);
  return res.tasks;
}

// ---------- Reminders ----------
const REMINDER_CATEGORIES = ["Meeting", "Mail", "Update", "Follow-up", "Call", "Payment", "Other"];
const REMINDER_STAGES = [["first", "1st"], ["second", "2nd"], ["final", "Final"]];

async function fetchMyReminders() {
  const res = await callSheet({ action: "getReminders", name: CURRENT_USER });
  if (res.status !== "success") throw new Error(res.message);
  return res.reminders;
}

function daysUntil(iso) {
  const today = new Date(toISO(new Date()) + "T00:00:00");
  return Math.round((new Date(iso + "T00:00:00") - today) / 86400000);
}

// The next reminder date that's due, or null if the reminder is closed
function reminderNext(r) {
  if (r.status === "Closed") return null;
  const today = toISO(new Date());
  for (const [key, stage] of REMINDER_STAGES) {
    const date = r[key];
    if (date && date >= today) {
      return { date, stage, days: daysUntil(date), state: date === today ? "today" : "upcoming" };
    }
  }
  return { date: r.final, stage: "Final", days: daysUntil(r.final), state: "overdue" };
}

function nextBadge(n) {
  if (!n) return `<span class="muted">–</span>`;
  const label =
    n.state === "today" ? "Due today" :
    n.state === "overdue" ? `Overdue ${-n.days} day${n.days === -1 ? "" : "s"}` :
    n.days === 1 ? "Tomorrow" : `In ${n.days} days`;
  return `<span class="due due-${n.state}">${label}</span><br><span class="muted small">${n.stage} · ${formatDMY(n.date)}</span>`;
}

function reminderStatusBadge(r) {
  if (r.status === "Closed") {
    return r.closedOnTime === "Yes"
      ? `<span class="badge st-Completed">Closed · on time</span>`
      : `<span class="badge st-Hold">Closed · late</span>`;
  }
  if (r.status === "Extended") return `<span class="badge st-Pending">Extended ×${r.extendedCount || 1}</span>`;
  return `<span class="badge st-Ongoing">Open</span>`;
}
