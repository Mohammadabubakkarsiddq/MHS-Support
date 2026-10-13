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

// Re-check name and role from the database; if they changed, refresh the page
if (CURRENT_USER) {
  callSheet({ action: "me" }).then((res) => {
    if (res.status !== "success") return;
    if (res.role !== CURRENT_ROLE || res.name !== CURRENT_USER) {
      sessionStorage.setItem("role", res.role);
      sessionStorage.setItem("username", res.name);
      sessionStorage.setItem("number", res.number);
      window.location.reload();
    }
  }).catch(() => {});
}

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

// ---------- Change password (profile menu) ----------
(function setupChangePassword() {
  const logoutBtn = document.getElementById("menuLogout");
  if (!logoutBtn) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pm-action";
  btn.id = "menuPassword";
  btn.setAttribute("role", "menuitem");
  btn.innerHTML = `<svg class="ico" viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg> Change password`;
  logoutBtn.before(btn);

  const eye = `<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.id = "pwModal";
  wrap.innerHTML = `
    <div class="modal modal-small" role="dialog" aria-modal="true" aria-labelledby="pwTitle">
      <div class="modal-head">
        <h3 id="pwTitle">Change password</h3>
        <button type="button" class="icon-btn" data-pw-close aria-label="Close">✕</button>
      </div>
      <form id="pwForm" novalidate>
        <div class="field">
          <label for="pwNew">New password</label>
          <div class="pw-wrap">
            <input type="password" id="pwNew" autocomplete="new-password" />
            <button type="button" class="pw-toggle" data-pw-eye="pwNew" aria-label="Show password">${eye}</button>
          </div>
          <ul class="pw-rules" id="pwNewRules">
            ${Object.keys(RULE_TEXT).map((k) => `<li data-rule="${k}">${RULE_TEXT[k].replace(/^(at least |an? )/, (m) => m === "at least " ? "At least " : "One ")}</li>`).join("")}
          </ul>
        </div>
        <div class="field">
          <label for="pwConfirm">Confirm new password</label>
          <div class="pw-wrap">
            <input type="password" id="pwConfirm" autocomplete="new-password" />
            <button type="button" class="pw-toggle" data-pw-eye="pwConfirm" aria-label="Show password">${eye}</button>
          </div>
          <p class="match-note" id="pwMatch"></p>
        </div>
        <div class="form-actions">
          <button type="button" class="btn-ghost" data-pw-close>Cancel</button>
          <button type="submit" class="btn-primary" id="pwSave">Change password</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(wrap);

  const $p = (id) => document.getElementById(id);
  const open = () => {
    $p("pwForm").reset();
    updateRules();
    profile?.classList.remove("open");
    wrap.classList.add("show");
    document.body.classList.add("modal-open");
    setTimeout(() => $p("pwNew").focus(), 50);
  };
  const close = () => { wrap.classList.remove("show"); document.body.classList.remove("modal-open"); };
  const updateRules = () => {
    const v = $p("pwNew").value;
    document.querySelectorAll("#pwNewRules li").forEach((li) => li.classList.toggle("ok", PASSWORD_RULES[li.dataset.rule](v)));
    const c = $p("pwConfirm").value;
    $p("pwMatch").textContent = !c ? "" : c === v ? "Passwords match" : "Passwords don't match yet";
    $p("pwMatch").className = "match-note" + (!c ? "" : c === v ? " ok" : " bad");
  };

  btn.addEventListener("click", open);
  wrap.querySelectorAll("[data-pw-close]").forEach((b) => b.addEventListener("click", close));
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && wrap.classList.contains("show")) close(); });
  $p("pwNew").addEventListener("input", updateRules);
  $p("pwConfirm").addEventListener("input", updateRules);
  wrap.querySelectorAll("[data-pw-eye]").forEach((b) => b.addEventListener("click", () => {
    const input = $p(b.dataset.pwEye);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    b.setAttribute("aria-label", show ? "Hide password" : "Show password");
    b.style.color = show ? "#6b2fb3" : "";
  }));

  $p("pwForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = $p("pwNew").value;
    const missing = Object.keys(PASSWORD_RULES).filter((k) => !PASSWORD_RULES[k](pw));
    if (missing.length) { $p("pwNew").focus(); return showPopup("Your new password needs " + missing.map((k) => RULE_TEXT[k]).join(", ") + "."); }
    if (pw !== $p("pwConfirm").value) { $p("pwConfirm").focus(); return showPopup("New password and confirm password do not match."); }
    const save = $p("pwSave");
    save.disabled = true;
    save.textContent = "Saving...";
    try {
      const res = await callSheet({ action: "changePassword", password: pw });
      if (res.status !== "success") throw new Error(res.message);
      close();
      showPopup("Password changed. Use your new password next time you log in.", "success");
    } catch (err) {
      showPopup(serverError(err));
    } finally {
      save.disabled = false;
      save.textContent = "Change password";
    }
  });
})();

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
    ? "Could not reach the server. Check your internet connection and try again."
    : err.message;
}

// ---------- Load this user's tasks ----------
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
