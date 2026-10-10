// =============================================================
// Dashboard page (home.html)
// =============================================================
const CARDS = [
  { key: "Total",       label: "Total tasks", color: "#5b2a86" },
  { key: "Not Started", label: "Not started", color: STATUS_COLORS["Not Started"] },
  { key: "Pending",     label: "Pending",     color: STATUS_COLORS.Pending },
  { key: "Ongoing",     label: "Ongoing",     color: STATUS_COLORS.Ongoing },
  { key: "Hold",        label: "Hold",        color: STATUS_COLORS.Hold },
  { key: "Completed",   label: "Completed",   color: STATUS_COLORS.Completed },
  { key: "Cancelled",   label: "Cancelled",   color: STATUS_COLORS.Cancelled },
];
const ORDER = { Ongoing: 0, Pending: 1, "Not Started": 2, Hold: 3, Completed: 4, Cancelled: 5 };
const cardId = (key) => key.replace(/\s+/g, "-");

const fromInput = document.getElementById("fromDate");
const toInput = document.getElementById("toDate");
const syncText = document.getElementById("syncText");
const refreshBtn = document.getElementById("refreshBtn");

let allTasks = [];
let allReminders = [];
let reminderError = "";
let charts = {};
let lastSync = null;

Chart.defaults.font.family = "Figtree, 'Segoe UI', Arial, sans-serif";
Chart.defaults.color = "#6f6483";

// Default range: 1st of this month to today
function setThisMonth() {
  const now = new Date();
  fromInput.value = toISO(new Date(now.getFullYear(), now.getMonth(), 1));
  toInput.value = toISO(now);
}

function daysBetween(fromIso, toIso) {
  const days = [];
  const d = new Date(fromIso + "T00:00:00");
  const end = new Date(toIso + "T00:00:00");
  while (d <= end && days.length < 370) {
    days.push(toISO(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

async function loadTasks() {
  syncText.textContent = "Loading...";
  refreshBtn.classList.add("spinning");
  const [taskResult, remResult] = await Promise.allSettled([fetchMyTasks(), fetchMyReminders()]);

  if (remResult.status === "fulfilled") {
    allReminders = remResult.value;
    reminderError = "";
  } else {
    reminderError = serverError(remResult.reason);
  }

  if (taskResult.status === "fulfilled") {
    allTasks = taskResult.value;
    lastSync = new Date();
    render();
    showTodaysReminders();
  } else {
    syncText.textContent = "Could not load tasks";
    renderReminders();
    showPopup(serverError(taskResult.reason));
  }
  refreshBtn.classList.remove("spinning");
}

function updateSyncText() {
  if (lastSync) syncText.textContent = "Last sync: " + timeAgo(lastSync);
}

function render() {
  const from = fromInput.value;
  const to = toInput.value;
  if (!from || !to) return;
  if (from > to) return showPopup("The from date must be on or before the to date.");

  const list = allTasks.filter((t) => t.startDate && t.startDate >= from && t.startDate <= to);
  const days = daysBetween(from, to);
  const pick = (key) => (key === "Total" ? list : list.filter((t) => t.status === key));
  const perDay = (tasks) => days.map((d) => tasks.filter((t) => t.startDate === d).length);

  Object.values(charts).forEach((c) => c.destroy());
  charts = {};

  renderCards(list, pick, from, to);
  CARDS.forEach((c) => drawSparkline(c, days, perDay(pick(c.key))));
  drawStatusChart(list);
  drawDailyChart(list, days);
  renderTable(list);
  renderReminders();
  updateSyncText();
}

function detailLine(key, tasks) {
  const count = (fn) => tasks.filter(fn).length;
  switch (key) {
    case "Completed": return `Completed on time: <b>${count((t) => !t.dueDate || (t.completedDate && t.completedDate <= t.dueDate))}</b>`;
    case "Not Started":
    case "Pending":
    case "Ongoing":   return `Overdue: <b>${count(isOverdue)}</b>`;
    default:          return `High priority: <b>${count((t) => t.priority === "High")}</b>`;
  }
}

function renderCards(list, pick, from, to) {
  const total = list.length;
  document.getElementById("statGrid").innerHTML = CARDS.map((c) => {
    const tasks = pick(c.key);
    const pct = total ? Math.round((tasks.length / total) * 100) : 0;
    const first = c.key === "Total"
      ? `${formatDMY(from)} – ${formatDMY(to)}`
      : `<b>${pct}%</b> of total tasks`;
    return `
      <article class="panel stat" style="--accent:${c.color}">
        <div class="stat-label"><h3>${c.label}</h3><span class="tag">live</span></div>
        <div class="stat-value">${tasks.length}<span class="dot"></span></div>
        <p class="stat-line">${first}</p>
        <p class="stat-line">${detailLine(c.key, tasks)}</p>
        <div class="spark"><canvas id="spark-${cardId(c.key)}" aria-label="${c.label} per day"></canvas></div>
      </article>`;
  }).join("");
}

function drawSparkline(card, days, values) {
  charts["spark" + card.key] = new Chart(document.getElementById("spark-" + cardId(card.key)), {
    type: "line",
    data: {
      labels: days,
      datasets: [{
        data: values, borderColor: card.color, backgroundColor: card.color + "22",
        fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { title: (items) => formatDMY(items[0].label), label: (i) => ` ${i.raw} task(s)` } },
      },
      scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
    },
  });
}

function drawStatusChart(list) {
  const counts = STATUS_LIST.map((s) => list.filter((t) => t.status === s).length);
  document.getElementById("statusEmpty").hidden = list.length > 0;
  charts.status = new Chart(document.getElementById("statusChart"), {
    type: "doughnut",
    data: {
      labels: STATUS_LIST,
      datasets: [{ data: counts, backgroundColor: STATUS_LIST.map((s) => STATUS_COLORS[s]), borderWidth: 2, borderColor: "#fff" }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "62%",
      plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8, padding: 14 } } },
    },
  });
}

function drawDailyChart(list, days) {
  charts.daily = new Chart(document.getElementById("dailyChart"), {
    type: "bar",
    data: {
      labels: days.map((d) => formatDMY(d).slice(0, 5)),
      datasets: STATUS_LIST.map((s) => ({
        label: s,
        data: days.map((d) => list.filter((t) => t.startDate === d && t.status === s).length),
        backgroundColor: STATUS_COLORS[s], borderRadius: 3, maxBarThickness: 28,
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8, padding: 14 } } },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#f0ebf6" } },
      },
    },
  });
}

function renderTable(list) {
  const rows = document.getElementById("taskRows");
  if (!list.length) {
    rows.innerHTML = `<tr class="empty-row"><td colspan="7">No tasks start in this date range. <a href="add-task.html">Add a task</a></td></tr>`;
    return;
  }
  const sorted = [...list].sort((a, b) =>
    ((ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9)) || (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  rows.innerHTML = sorted.map((t) => `
    <tr>
      <td class="nowrap muted">${esc(t.id)}</td>
      <td><a href="view-tasks.html?edit=${encodeURIComponent(t.id)}">${esc(t.title)}</a>${t.assignedBy ? `<br>${assignedChip(t)}` : ""}</td>
      <td>${esc(t.category)}</td>
      <td class="prio-${esc(t.priority)}">${esc(t.priority)}</td>
      <td>${statusBadge(t.status)}</td>
      <td class="nowrap">${formatDMY(t.startDate)}</td>
      <td class="nowrap ${isOverdue(t) ? "overdue" : ""}">${formatDMY(t.dueDate)}</td>
    </tr>`).join("");
}

// ---------- Reminders (always shows current state, not the date range) ----------
function renderReminders() {
  const stats = document.getElementById("remStats");
  const rows = document.getElementById("remRows");
  if (reminderError) {
    stats.innerHTML = "";
    rows.innerHTML = `<tr class="empty-row"><td colspan="5">Couldn't load reminders: ${esc(reminderError)}</td></tr>`;
    return;
  }
  const active = allReminders.filter((r) => r.status !== "Closed");
  const withNext = active.map((r) => ({ r, n: reminderNext(r) }));
  const dueToday = withNext.filter((x) => x.n.state === "today").length;
  const overdue = withNext.filter((x) => x.n.state === "overdue").length;
  const closed = allReminders.filter((r) => r.status === "Closed");
  const onTime = closed.filter((r) => r.closedOnTime === "Yes").length;

  const mini = (label, value, line, color, href) => `
    <a class="panel mini" style="--accent:${color}" href="${href}">
      <h3>${label}</h3>
      <div class="mini-value">${value}</div>
      <p class="stat-line">${line}</p>
    </a>`;
  stats.innerHTML =
    mini("Active", active.length, `Extended: <b>${active.filter((r) => r.status === "Extended").length}</b>`, "#5b2a86", "reminders.html") +
    mini("Due today", dueToday, "Any stage due today", "#e8890c", "reminders.html?view=due") +
    mini("Overdue", overdue, "Final date passed", "#d9365a", "reminders.html?view=due") +
    mini("Closed", closed.length, `On time: <b>${onTime}</b>`, "#1f9d55", "reminders.html?view=closed");

  const upcoming = withNext
    .sort((a, b) => ((a.n.state === "overdue" ? "0" : "1") + a.n.date).localeCompare((b.n.state === "overdue" ? "0" : "1") + b.n.date))
    .slice(0, 6);
  rows.innerHTML = upcoming.length
    ? upcoming.map(({ r, n }) => `
      <tr>
        <td class="nowrap muted">${esc(r.id)}</td>
        <td class="title-cell">${esc(r.description)}<br><span class="muted">${esc(r.category)}</span></td>
        <td class="prio-${esc(r.priority)}">${esc(r.priority)}</td>
        <td class="nowrap">${nextBadge(n)}</td>
        <td>${reminderStatusBadge(r)}</td>
      </tr>`).join("")
    : `<tr class="empty-row"><td colspan="5">No active reminders. <a href="add-reminder.html">Add a reminder</a></td></tr>`;
}

// Pop-up once per login when reminders are due today (or overdue)
function showTodaysReminders() {
  if (reminderError || sessionStorage.getItem("remindersShown")) return;
  sessionStorage.setItem("remindersShown", "1");
  const due = allReminders
    .filter((r) => r.status !== "Closed")
    .map((r) => ({ r, n: reminderNext(r) }))
    .filter(({ n }) => n.state === "today" || n.state === "overdue")
    .sort((a, b) => (a.n.state === "today" ? 0 : 1) - (b.n.state === "today" ? 0 : 1))
    .map(({ r, n }) => ({ id: r.id, description: r.description, stage: n.stage, state: n.state, date: n.date }));
  if (due.length) showReminderPopup(due, () => (window.location.href = "reminders.html?view=due"));
}

// ---------- Events ----------
fromInput.addEventListener("change", render);
toInput.addEventListener("change", render);
document.getElementById("rangeReset").addEventListener("click", () => { setThisMonth(); render(); });
refreshBtn.addEventListener("click", loadTasks);
setInterval(updateSyncText, 30000);

if (CURRENT_USER) {
  setThisMonth();
  loadTasks();
}
