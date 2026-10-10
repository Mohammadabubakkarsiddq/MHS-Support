// =============================================================
// My Calendar page (calendar.html)
// Plan vs Actual, 9:00 AM – 6:00 PM, week or day view
// =============================================================
const $ = (id) => document.getElementById(id);

const DAY_START = 9 * 60;   // 9:00 AM
const DAY_END = 18 * 60;    // 6:00 PM
const STEP = 30;            // minutes per slot
const PX = 1.15;            // pixels per minute (one hour = 69px)
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
                "August", "September", "October", "November", "December"];

// Colours like the AGM calendar sheet
const CAL_COLORS = [
  { hex: "#ffffff", name: "White" },
  { hex: "#3ddc4b", name: "Green" },
  { hex: "#2fd6e8", name: "Cyan" },
  { hex: "#fde047", name: "Yellow" },
  { hex: "#f2c14e", name: "Gold" },
  { hex: "#e8b4ac", name: "Salmon" },
  { hex: "#ef3b3b", name: "Red" },
  { hex: "#7e3fa8", name: "Purple" },
  { hex: "#1d3fe0", name: "Blue" },
  { hex: "#3f9fb5", name: "Teal" },
  { hex: "#9caf5a", name: "Olive" },
  { hex: "#b5b5b5", name: "Grey" },
  { hex: "#d9d2ec", name: "Lavender" },
];

let view = "week";
let anchor = toISO(new Date());
let entries = [];
let loadedWeek = null;
let lastSync = null;
let editing = null;   // entry being edited, or null when adding
let formType = "Plan";
let formColor = CAL_COLORS[0].hex;

// ---------- Date / time helpers ----------
function parseISO(iso) { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); }
function addDays(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); }
function mondayOf(iso) { const d = parseISO(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return toISO(d); }
function toMin(t) { const [h, m] = String(t).split(":").map(Number); return h * 60 + m; }
function toHHMM(min) { return String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0"); }
function label12(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
function hoursText(min) { const h = min / 60; return (Number.isInteger(h) ? h : h.toFixed(1)) + "h"; }
function weekDays(iso) {
  const mon = mondayOf(iso);
  return Array.from({ length: $("showSunday").checked ? 7 : 6 }, (_, i) => addDays(mon, i));
}
function visibleDays() { return view === "day" ? [anchor] : weekDays(anchor); }
function textOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#23163a" : "#ffffff";
}

// ---------- Load the whole week ----------
async function loadWeek(force) {
  const mon = mondayOf(anchor);
  if (!force && loadedWeek === mon) { render(); return; }
  $("syncText").textContent = "Loading calendar...";
  $("refreshBtn").classList.add("spinning");
  try {
    const res = await callSheet({ action: "getCalendar", from: mon, to: addDays(mon, 6) });
    if (res.status !== "success") throw new Error(res.message);
    entries = res.entries;
    loadedWeek = mon;
    lastSync = new Date();
    $("syncText").textContent = "Last sync: " + timeAgo(lastSync);
  } catch (err) {
    $("syncText").textContent = "Could not load calendar";
    showPopup(serverError(err));
  } finally {
    $("refreshBtn").classList.remove("spinning");
  }
  render();
}

// ---------- Draw the grid ----------
function render() {
  const days = visibleDays();
  const today = toISO(new Date());
  const thu = parseISO(addDays(mondayOf(anchor), 3)); // week belongs to the month its Thursday is in

  if (view === "week") {
    $("calTitle").textContent = `${MONTHS[thu.getMonth()]} ${thu.getFullYear()} – Week ${Math.ceil(thu.getDate() / 7)}`;
    $("calSub").textContent = `${formatDMY(days[0])} to ${formatDMY(days[days.length - 1])}`;
  } else {
    const d = parseISO(anchor);
    $("calTitle").textContent = `${DAY_FULL[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    $("calSub").textContent = anchor === today ? "Today" : "";
  }
  $("jumpDate").value = anchor;
  $("todayBtn").textContent = view === "week" ? "This week" : "Today";

  // Plan vs actual hours for what's on screen
  const inView = entries.filter((e) => days.includes(e.date));
  const sum = (type) => inView.filter((e) => e.type === type).reduce((s, e) => s + toMin(e.end) - toMin(e.start), 0);
  $("calSub").textContent += `${$("calSub").textContent ? "  |  " : ""}Planned ${hoursText(sum("Plan"))}, actual ${hoursText(sum("Actual"))}`;

  const grid = $("calGrid");
  grid.style.setProperty("--cols", days.length * 2);
  grid.style.setProperty("--hour", 60 * PX + "px");
  grid.classList.toggle("is-day", view === "day");
  const bodyH = (DAY_END - DAY_START) * PX;

  let html = `<div class="cal-corner">Time</div>`;
  days.forEach((d) => {
    const dt = parseISO(d);
    html += `<button type="button" class="cal-day-head ${d === today ? "is-today" : ""}" data-goday="${d}" title="Open day view">
      <b>${DAY_NAMES[dt.getDay()]}</b><span>${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}</span></button>`;
  });
  days.forEach((d) => ["Plan", "Actual"].forEach((type) => {
    const mins = entries.filter((e) => e.date === d && e.type === type).reduce((s, e) => s + toMin(e.end) - toMin(e.start), 0);
    html += `<div class="cal-sub ${type === "Actual" ? "is-actual" : ""}">${type === "Plan" ? "Plan" : "Actual"}<span>${mins ? hoursText(mins) : "–"}</span></div>`;
  }));

  html += `<div class="cal-times" style="height:${bodyH}px">`;
  for (let m = DAY_START; m <= DAY_END; m += 60) {
    html += `<span style="top:${(m - DAY_START) * PX}px">${label12(m)}</span>`;
  }
  html += `</div>`;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  days.forEach((d) => ["Plan", "Actual"].forEach((type) => {
    const list = entries.filter((e) => e.date === d && e.type === type);
    html += `<div class="cal-col ${type === "Actual" ? "is-actual" : ""} ${d === today ? "is-today" : ""} ${type === "Actual" ? "day-end" : ""}"
      data-date="${d}" data-type="${type}" style="height:${bodyH}px">`;
    html += layout(list).map(entryHTML).join("");
    if (d === today && nowMin > DAY_START && nowMin < DAY_END) {
      html += `<div class="cal-now" style="top:${(nowMin - DAY_START) * PX}px"></div>`;
    }
    html += `</div>`;
  }));

  grid.innerHTML = html;
}

// Side-by-side lanes for overlapping entries in one column
function layout(list) {
  const sorted = [...list].sort((a, b) => toMin(a.start) - toMin(b.start) || toMin(b.end) - toMin(a.end));
  const out = [];
  let cluster = [], lanes = [], clusterEnd = -1;
  const flush = () => { cluster.forEach((c) => (c.lanes = lanes.length)); out.push(...cluster); cluster = []; lanes = []; };
  sorted.forEach((e) => {
    const s = toMin(e.start), en = toMin(e.end);
    if (s >= clusterEnd && cluster.length) flush();
    let lane = lanes.findIndex((end) => end <= s);
    if (lane === -1) { lane = lanes.length; lanes.push(en); } else lanes[lane] = en;
    cluster.push({ e, lane });
    clusterEnd = Math.max(clusterEnd, en);
  });
  if (cluster.length) flush();
  return out;
}

function entryHTML({ e, lane, lanes }) {
  const s = toMin(e.start), en = toMin(e.end);
  const top = (Math.max(s, DAY_START) - DAY_START) * PX;
  const h = (Math.min(en, DAY_END) - Math.max(s, DAY_START)) * PX - 3;
  const color = /^#[0-9a-f]{6}$/i.test(e.color) ? e.color : "#ffffff";
  const time = `${label12(s)} – ${label12(en)}`;
  return `<button type="button" class="cal-entry ${color.toLowerCase() === "#ffffff" ? "is-white" : ""} ${h < 30 ? "is-short" : ""}"
    data-id="${esc(e.id)}"
    style="top:${top + 1}px;height:${h}px;left:calc(${(100 / lanes) * lane}% + 2px);width:calc(${100 / lanes}% - 4px);background:${color};color:${textOn(color)}"
    title="${esc(e.activity)}\n${time}${e.notes ? "\n" + esc(e.notes) : ""}">
    <span class="ce-title">${esc(e.activity)}</span>${h >= 95 || (view === "day" && h >= 30) ? `<span class="ce-time">${time}</span>` : ""}</button>`;
}

// ---------- Entry form ----------
function fillTimes() {
  const opts = (from, to) => { let h = ""; for (let m = from; m <= to; m += STEP) h += `<option value="${toHHMM(m)}">${label12(m)}</option>`; return h; };
  $("en-start").innerHTML = opts(DAY_START, DAY_END - STEP);
  $("en-end").innerHTML = opts(DAY_START + STEP, DAY_END);
}
fillTimes();

$("en-colors").innerHTML = CAL_COLORS.map((c) =>
  `<button type="button" class="swatch" role="radio" data-color="${c.hex}" style="background:${c.hex}" title="${c.name}" aria-label="${c.name}"></button>`).join("");

function setType(t) {
  formType = t;
  document.querySelectorAll("#en-type button").forEach((b) => {
    b.classList.toggle("active", b.dataset.type === t);
    b.setAttribute("aria-checked", b.dataset.type === t);
  });
  $("copyActualBtn").hidden = !editing || editing.type !== "Plan";
}
function setColor(hex) {
  formColor = hex;
  document.querySelectorAll(".swatch").forEach((b) => {
    b.classList.toggle("active", b.dataset.color === hex);
    b.setAttribute("aria-checked", b.dataset.color === hex);
  });
}
function setFullDay(on) {
  $("en-fullday").checked = on;
  if (on) { $("en-start").value = toHHMM(DAY_START); $("en-end").value = toHHMM(DAY_END); }
  $("en-start").disabled = on;
  $("en-end").disabled = on;
}
function fillRepeatDays() {
  const date = $("en-date").value;
  if (!date) { $("en-repeat").innerHTML = ""; return; }
  $("en-repeat").innerHTML = weekDays(date).filter((d) => d !== date).map((d) => {
    const dt = parseISO(d);
    return `<label class="day-pick"><input type="checkbox" value="${d}" /> ${DAY_NAMES[dt.getDay()]} ${String(dt.getDate()).padStart(2, "0")}</label>`;
  }).join("");
}

function openForm(entry, preset) {
  editing = entry || null;
  const p = entry || preset || {};
  $("entryTitle").textContent = entry ? `Edit entry ${entry.id}` : "Add calendar entry";
  $("en-activity").value = p.activity || "";
  $("en-date").value = p.date || anchor;
  $("en-notes").value = p.notes || "";
  const start = p.start ? toMin(p.start) : DAY_START;
  $("en-start").value = toHHMM(Math.min(start, DAY_END - STEP));
  $("en-end").value = toHHMM(p.end ? toMin(p.end) : Math.min(start + 60, DAY_END));
  setFullDay(Boolean(entry) && toMin(p.start) === DAY_START && toMin(p.end) === DAY_END);
  setColor(p.color || CAL_COLORS[0].hex);
  document.querySelectorAll("[data-add-only]").forEach((b) => (b.hidden = Boolean(entry)));
  setType(p.type || "Plan");
  $("deleteBtn").hidden = !entry;
  $("repeatField").hidden = Boolean(entry);
  fillRepeatDays();
  $("saveBtn").textContent = entry ? "Save changes" : "Add entry";
  $("en-activity").classList.remove("invalid");
  $("entryModal").classList.add("show");
  document.body.classList.add("modal-open");
  setTimeout(() => $("en-activity").focus(), 50);
}
function closeForm() {
  $("entryModal").classList.remove("show");
  document.body.classList.remove("modal-open");
  editing = null;
}

function readForm() {
  const entry = {
    activity: $("en-activity").value.trim(),
    date: $("en-date").value,
    start: $("en-start").value,
    end: $("en-end").value,
    color: formColor,
    notes: $("en-notes").value.trim(),
  };
  if (!entry.activity) { $("en-activity").classList.add("invalid"); $("en-activity").focus(); return { error: "Enter the activity." }; }
  if (!entry.date) return { error: "Choose a date." };
  if (toMin(entry.end) <= toMin(entry.start)) return { error: "End time must be after the start time." };
  return { entry };
}

async function send(payload, successMsg, btn) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Saving...";
  try {
    const res = await callSheet(payload);
    if (res.status !== "success") throw new Error(res.message);
    closeForm();
    showPopup(successMsg, "success");
    await loadWeek(true);
  } catch (err) {
    showPopup(serverError(err));
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

$("entryForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const { entry, error } = readForm();
  if (error) return showPopup(error);
  if (editing) {
    entry.type = formType;
    send({ action: "updateCalendarEntry", id: editing.id, entry }, "Calendar entry updated.", $("saveBtn"));
  } else {
    const dates = [entry.date, ...[...document.querySelectorAll("#en-repeat input:checked")].map((c) => c.value)];
    const types = formType === "Both" ? ["Plan", "Actual"] : [formType];
    const n = dates.length * types.length;
    send({ action: "addCalendarEntry", entry, dates, types },
      n === 1 ? "Calendar entry added." : `${n} calendar entries added.`, $("saveBtn"));
  }
});

$("copyActualBtn").addEventListener("click", () => {
  const { entry, error } = readForm();
  if (error) return showPopup(error);
  send({ action: "addCalendarEntry", entry, dates: [entry.date], types: ["Actual"] },
    "Copied to Actual. Adjust the times there if it ran differently.", $("copyActualBtn"));
});

$("deleteBtn").addEventListener("click", () => {
  const target = editing;
  showConfirm(`Delete "${target.activity}" (${target.type}, ${formatDMY(target.date)})?`,
    { title: "Delete entry?", yesLabel: "Delete" }, async () => {
      try {
        const res = await callSheet({ action: "deleteCalendarEntry", id: target.id });
        if (res.status !== "success") throw new Error(res.message);
        closeForm();
        showPopup("Calendar entry deleted.", "success");
        await loadWeek(true);
      } catch (err) {
        showPopup(serverError(err));
      }
    });
});

document.querySelectorAll("#en-type button").forEach((b) => b.addEventListener("click", () => setType(b.dataset.type)));
$("en-colors").addEventListener("click", (e) => { const s = e.target.closest(".swatch"); if (s) setColor(s.dataset.color); });
$("en-fullday").addEventListener("change", (e) => setFullDay(e.target.checked));
$("en-date").addEventListener("change", fillRepeatDays);
$("en-start").addEventListener("change", () => {
  if (toMin($("en-end").value) <= toMin($("en-start").value)) $("en-end").value = toHHMM(Math.min(toMin($("en-start").value) + 60, DAY_END));
});
$("en-activity").addEventListener("input", () => $("en-activity").classList.remove("invalid"));
document.querySelectorAll("[data-close-modal]").forEach((b) => b.addEventListener("click", closeForm));
$("entryModal").addEventListener("click", (e) => { if (e.target === $("entryModal")) closeForm(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("popup").classList.contains("show")) closeForm();
});

// ---------- Grid clicks ----------
$("calGrid").addEventListener("click", (e) => {
  const entryBtn = e.target.closest(".cal-entry");
  if (entryBtn) {
    const entry = entries.find((x) => x.id === entryBtn.dataset.id);
    if (entry) openForm(entry);
    return;
  }
  const head = e.target.closest("[data-goday]");
  if (head) { anchor = head.dataset.goday; setView("day"); return; }
  const col = e.target.closest(".cal-col");
  if (col) {
    const y = e.clientY - col.getBoundingClientRect().top;
    const start = DAY_START + Math.floor(y / PX / STEP) * STEP;
    openForm(null, { date: col.dataset.date, type: col.dataset.type, start: toHHMM(Math.min(start, DAY_END - STEP)) });
  }
});

// ---------- Toolbar ----------
function setView(v) {
  view = v;
  document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
  loadWeek(false);
}
document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
$("prevBtn").addEventListener("click", () => { anchor = addDays(anchor, view === "week" ? -7 : -1); loadWeek(false); });
$("nextBtn").addEventListener("click", () => { anchor = addDays(anchor, view === "week" ? 7 : 1); loadWeek(false); });
$("todayBtn").addEventListener("click", () => { anchor = toISO(new Date()); loadWeek(false); });
$("jumpDate").addEventListener("change", (e) => { if (e.target.value) { anchor = e.target.value; loadWeek(false); } });
$("showSunday").addEventListener("change", render);
$("addBtn").addEventListener("click", () => openForm(null, { date: anchor, type: "Plan" }));
$("refreshBtn").addEventListener("click", () => loadWeek(true));

// Keep "last sync" and the red "now" line fresh
setInterval(() => {
  if (lastSync) $("syncText").textContent = "Last sync: " + timeAgo(lastSync);
  if (!$("entryModal").classList.contains("show")) render();
}, 60000);

loadWeek(true);
