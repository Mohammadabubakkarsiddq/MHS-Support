// =============================================================
// Shared code for logged-in pages (Dashboard, Add Task, View & Edit Task)
// Load AFTER script.js
// =============================================================
const CURRENT_USER = sessionStorage.getItem("username");
if (!CURRENT_USER) window.location.replace("index.html"); // not logged in

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

// Log out
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  sessionStorage.removeItem("username");
  window.location.href = "index.html";
});

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
