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
  syncText.textContent = "Loading tasks...";
  refreshBtn.classList.add("spinning");
  try {
    allTasks = await fetchMyTasks();
    lastSync = new Date();
    render();
  } catch (err) {
    syncText.textContent = "Could not load tasks";
    showPopup(err instanceof TypeError
      ? "Could not reach the server. Check the SCRIPT_URL in script.js."
      : err.message);
  } finally {
    refreshBtn.classList.remove("spinning");
  }
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
        <div class="stat-label"><h3>${c.label}</h3><span class="tag">sheet</span></div>
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
      <td><a href="view-tasks.html?edit=${encodeURIComponent(t.id)}">${esc(t.title)}</a></td>
      <td>${esc(t.category)}</td>
      <td class="prio-${esc(t.priority)}">${esc(t.priority)}</td>
      <td>${statusBadge(t.status)}</td>
      <td class="nowrap">${formatDMY(t.startDate)}</td>
      <td class="nowrap ${isOverdue(t) ? "overdue" : ""}">${formatDMY(t.dueDate)}</td>
    </tr>`).join("");
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
