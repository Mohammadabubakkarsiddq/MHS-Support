// =============================================================
// View Reminders page (reminders.html)
// =============================================================
const $ = (id) => document.getElementById(id);
const syncText = $("syncText");
const refreshBtn = $("refreshBtn");
const editModal = $("editModal");
const editForm = $("editForm");
const extendModal = $("extendModal");
const extendForm = $("extendForm");

let reminders = [];
let activeId = null;
let lastSync = null;

buildReminderForm(editForm.querySelector(".form-fields"), "edit");

async function loadReminders() {
  syncText.textContent = "Loading reminders...";
  refreshBtn.classList.add("spinning");
  try {
    reminders = await fetchMyReminders();
    lastSync = new Date();
    syncText.textContent = "Last sync: " + timeAgo(lastSync);
    renderTable();
  } catch (err) {
    syncText.textContent = "Could not load reminders";
    showPopup(serverError(err));
  } finally {
    refreshBtn.classList.remove("spinning");
  }
}

function sortKey(r) {
  const n = reminderNext(r);
  if (!n) return "9" + (r.closedOn || ""); // closed go last
  return (n.state === "overdue" ? "0" : "1") + n.date;
}

function scheduleCell(r) {
  const next = reminderNext(r);
  const today = toISO(new Date());
  return `<div class="schedule">${REMINDER_STAGES.map(([key, stage]) => {
    if (!r[key]) return "";
    const cls = next && next.stage === stage ? "is-next" : r.status !== "Closed" && r[key] < today ? "is-past" : "";
    return `<span class="${cls}"><b>${stage}</b> ${formatDMY(r[key])}</span>`;
  }).join("")}</div>`;
}

function renderTable() {
  const q = $("search").value.trim().toLowerCase();
  const view = $("viewFilter").value;
  const list = reminders
    .filter((r) => view === "all" || (view === "closed" ? r.status === "Closed" : r.status !== "Closed"))
    .filter((r) => {
      if (view !== "due") return true;
      const n = reminderNext(r);
      return n && (n.state === "today" || n.state === "overdue");
    })
    .filter((r) => !q || [r.id, r.description, r.category].some((v) => String(v).toLowerCase().includes(q)))
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  $("remCount").textContent = `${list.length} of ${reminders.length} reminder${reminders.length === 1 ? "" : "s"}`;

  if (!list.length) {
    $("remRows").innerHTML = `<tr class="empty-row"><td colspan="7">${
      reminders.length ? "No reminders match this view." : `No reminders yet. <a href="add-reminder.html">Add your first reminder</a>`
    }</td></tr>`;
    return;
  }

  $("remRows").innerHTML = list.map((r) => {
    const closed = r.status === "Closed";
    return `
    <tr class="${closed ? "is-closed" : ""}">
      <td class="nowrap muted">${esc(r.id)}</td>
      <td class="title-cell">${esc(r.description)}<br><span class="muted">${esc(r.category)}</span></td>
      <td class="prio-${esc(r.priority)}">${esc(r.priority)}</td>
      <td>${scheduleCell(r)}</td>
      <td class="nowrap">${closed ? `<span class="muted small">Closed ${formatDMY(r.closedOn)}</span>` : nextBadge(reminderNext(r))}</td>
      <td>${reminderStatusBadge(r)}</td>
      <td>
        <div class="row-actions">
          ${closed ? "" : `
            <button type="button" class="btn-close" data-act="close" data-id="${esc(r.id)}">Close</button>
            <button type="button" class="btn-edit" data-act="extend" data-id="${esc(r.id)}">Extend</button>
            <button type="button" class="btn-edit" data-act="edit" data-id="${esc(r.id)}">Edit</button>`}
          <button type="button" class="btn-delete" data-act="delete" data-id="${esc(r.id)}">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

// ---------- Actions ----------
async function send(payload, successMsg) {
  const res = await callSheet({ name: CURRENT_USER, ...payload });
  if (res.status !== "success") throw new Error(res.message);
  if (successMsg) showPopup(typeof successMsg === "function" ? successMsg(res) : successMsg, "success");
  await loadReminders();
  return res;
}

function askClose(r) {
  const n = reminderNext(r);
  const late = n && n.state === "overdue";
  showConfirm(
    late
      ? `The final reminder date (${formatDMY(r.final)}) has passed, so this will be recorded as closed late.`
      : `This will be recorded as closed on time. Final reminder date: ${formatDMY(r.final)}.`,
    { title: "Close this reminder?", yesLabel: "Yes, close it", noLabel: "Not yet", kind: "reminder", danger: false },
    () => send({ action: "closeReminder", id: r.id },
      (res) => res.onTime ? `Reminder ${r.id} closed on time. Nicely done!` : `Reminder ${r.id} closed (late).`)
      .catch((err) => showPopup(serverError(err)))
  );
}

function askDelete(r) {
  showConfirm(
    `"${r.description}" (${r.id}) will be removed from the sheet. This can't be undone.`,
    { title: "Delete this reminder?", yesLabel: "Yes, delete", noLabel: "Keep it" },
    () => send({ action: "deleteReminder", id: r.id }, `Reminder ${r.id} deleted.`)
      .catch((err) => showPopup(serverError(err)))
  );
}

function openModal(modal) {
  modal.classList.add("show");
  document.body.classList.add("modal-open");
}
function closeModals() {
  activeId = null;
  [editModal, extendModal].forEach((m) => m.classList.remove("show"));
  document.body.classList.remove("modal-open");
}

function openEdit(r) {
  activeId = r.id;
  fillReminderForm(editForm, r);
  $("editTitle").textContent = `Edit reminder ${r.id}`;
  openModal(editModal);
  editForm.elements.description.focus();
}

function openExtend(r) {
  activeId = r.id;
  extendForm.reset();
  const min = [r.final, toISO(new Date())].sort().pop();
  const minDate = new Date(min + "T00:00:00");
  minDate.setDate(minDate.getDate() + 1);
  extendForm.elements.newFinal.min = toISO(minDate);
  $("extendTitle").textContent = `Extend reminder ${r.id}`;
  $("extendInfo").innerHTML = `Current final reminder: <b>${formatDMY(r.final)}</b>${
    r.extendedCount ? ` · already extended ${r.extendedCount} time${r.extendedCount === 1 ? "" : "s"}` : ""}`;
  openModal(extendModal);
  extendForm.elements.newFinal.focus();
}

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const reminder = readReminderForm(editForm);
  if (!reminder) return;
  const btn = $("editSave");
  btn.disabled = true; btn.textContent = "Saving...";
  try {
    const id = activeId;
    await send({ action: "updateReminder", id, reminder }, `Reminder ${id} updated.`);
    closeModals();
  } catch (err) {
    showPopup(serverError(err));
  } finally {
    btn.disabled = false; btn.textContent = "Save changes";
  }
});

extendForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const newFinal = extendForm.elements.newFinal.value;
  const note = extendForm.elements.note.value.trim();
  const r = reminders.find((x) => x.id === activeId);
  clearInvalid(extendForm);
  if (!newFinal) {
    extendForm.elements.newFinal.classList.add("invalid");
    return showPopup("Choose the new final reminder date.");
  }
  if (newFinal < extendForm.elements.newFinal.min) {
    extendForm.elements.newFinal.classList.add("invalid");
    return showPopup(`The new date must be after ${formatDMY(r.final)} and not in the past.`);
  }
  const btn = $("extendSave");
  btn.disabled = true; btn.textContent = "Extending...";
  try {
    const id = activeId;
    await send({ action: "extendReminder", id, newFinal, note }, `Reminder ${id} extended to ${formatDMY(newFinal)}.`);
    closeModals();
  } catch (err) {
    showPopup(serverError(err));
  } finally {
    btn.disabled = false; btn.textContent = "Extend";
  }
});

// ---------- Events ----------
$("remRows").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const r = reminders.find((x) => x.id === btn.dataset.id);
  if (!r) return;
  ({ close: askClose, extend: openExtend, edit: openEdit, delete: askDelete })[btn.dataset.act](r);
});
document.querySelectorAll("[data-close-modal]").forEach((b) => b.addEventListener("click", closeModals));
[editModal, extendModal].forEach((m) => m.addEventListener("click", (e) => { if (e.target === m) closeModals(); }));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("popup").classList.contains("show")) closeModals();
});
$("search").addEventListener("input", renderTable);
$("viewFilter").addEventListener("change", renderTable);
refreshBtn.addEventListener("click", loadReminders);
setInterval(() => lastSync && (syncText.textContent = "Last sync: " + timeAgo(lastSync)), 30000);

// Open with a filter, e.g. reminders.html?view=due
const startView = new URLSearchParams(location.search).get("view");
if (startView && [...$("viewFilter").options].some((o) => o.value === startView)) $("viewFilter").value = startView;

if (CURRENT_USER) loadReminders();
