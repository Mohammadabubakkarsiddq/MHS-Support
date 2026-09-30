// =============================================================
// Assigned Tasks page (assigned-tasks.html) — admins only
// Shows every task this admin assigned, with live status
// =============================================================
const $ = (id) => document.getElementById(id);
const syncText = $("syncText");
const refreshBtn = $("refreshBtn");
const modal = $("editModal");
const editForm = $("editForm");
const modalSave = $("modalSave");

let tasks = [];
let editingId = null;
let lastSync = null;

buildTaskForm(editForm.querySelector(".form-fields"), "edit");

async function loadTasks() {
  syncText.textContent = "Loading tasks...";
  refreshBtn.classList.add("spinning");
  try {
    const res = await callSheet({ action: "getAssignedTasks" });
    if (res.status !== "success") throw new Error(res.message);
    tasks = res.tasks;
    lastSync = new Date();
    syncText.textContent = "Last sync: " + timeAgo(lastSync);
    fillPeopleFilter();
    render();
  } catch (err) {
    syncText.textContent = "Could not load tasks";
    showPopup(serverError(err));
  } finally {
    refreshBtn.classList.remove("spinning");
  }
}

function fillPeopleFilter() {
  const select = $("personFilter");
  const current = select.value;
  const people = [...new Set(tasks.map((t) => t.username))].sort((a, b) => a.localeCompare(b));
  select.innerHTML = `<option value="">All employees</option>` +
    people.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
  select.value = people.includes(current) ? current : "";
}

function filtered() {
  const q = $("search").value.trim().toLowerCase();
  const person = $("personFilter").value;
  const status = $("statusFilter").value;
  return tasks
    .filter((t) => !person || t.username === person)
    .filter((t) => !status || (status === "Overdue" ? isOverdue(t) : t.status === status))
    .filter((t) => !q || [t.id, t.title, t.category, t.username].some((v) => String(v).toLowerCase().includes(q)));
}

function render() {
  // Status summary for the chosen employee (or everyone)
  const person = $("personFilter").value;
  const scope = tasks.filter((t) => !person || t.username === person);
  $("teamSummary").innerHTML =
    `<button type="button" class="sum-chip" data-status="" style="--c:#5b2a86"><b>${scope.length}</b> Total</button>` +
    STATUS_LIST.map((s) => `<button type="button" class="sum-chip" data-status="${esc(s)}" style="--c:${STATUS_COLORS[s]}"><b>${scope.filter((t) => t.status === s).length}</b> ${esc(s)}</button>`).join("") +
    `<button type="button" class="sum-chip" data-status="Overdue" style="--c:#d9365a"><b>${scope.filter(isOverdue).length}</b> Overdue</button>`;
  document.querySelectorAll(".sum-chip").forEach((c) =>
    c.classList.toggle("active", c.dataset.status === $("statusFilter").value));

  const list = filtered().sort((a, b) => (b.updatedOn || "").localeCompare(a.updatedOn || ""));
  $("taskCount").textContent = `${list.length} of ${tasks.length} assigned task${tasks.length === 1 ? "" : "s"}`;

  if (!list.length) {
    $("taskRows").innerHTML = `<tr class="empty-row"><td colspan="9">${
      tasks.length ? "No tasks match this filter." : `You haven't assigned any tasks yet. <a href="assign-task.html">Assign a task</a>`
    }</td></tr>`;
    return;
  }
  $("taskRows").innerHTML = list.map((t) => `
    <tr>
      <td class="nowrap muted">${esc(t.id)}</td>
      <td class="title-cell">${esc(t.title)}${t.category ? `<br><span class="muted">${esc(t.category)}</span>` : ""}</td>
      <td class="nowrap"><span class="person">${esc(t.username.charAt(0).toUpperCase())}</span>${esc(t.username)}</td>
      <td class="prio-${esc(t.priority)}">${esc(t.priority)}</td>
      <td>${statusBadge(t.status)}${t.remarks ? `<br><span class="muted small" title="${esc(t.remarks)}">${esc(t.remarks.length > 40 ? t.remarks.slice(0, 40) + "…" : t.remarks)}</span>` : ""}</td>
      <td class="nowrap">${formatDMY(t.startDate)}</td>
      <td class="nowrap ${isOverdue(t) ? "overdue" : ""}">${formatDMY(t.dueDate)}</td>
      <td class="nowrap muted">${formatDMY((t.updatedOn || "").slice(0, 10))}</td>
      <td class="nowrap">
        <div class="row-actions">
          <button type="button" class="btn-edit" data-edit="${esc(t.id)}">Edit</button>
          <button type="button" class="btn-delete" data-delete="${esc(t.id)}">Delete</button>
        </div>
      </td>
    </tr>`).join("");
}

// ---------- Edit ----------
function openEdit(id) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  editingId = id;
  fillTaskForm(editForm, t);
  $("modalTitle").textContent = `Edit task ${id} · ${t.username}`;
  modal.classList.add("show");
  document.body.classList.add("modal-open");
  editForm.elements.title.focus();
}
function closeEdit() {
  editingId = null;
  modal.classList.remove("show");
  document.body.classList.remove("modal-open");
}

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const task = readTaskForm(editForm);
  if (!task) return;
  modalSave.disabled = true;
  modalSave.textContent = "Saving...";
  try {
    const res = await callSheet({ action: "updateTask", id: editingId, task });
    if (res.status !== "success") throw new Error(res.message);
    closeEdit();
    showPopup(`Task ${res.id} updated.`, "success");
    await loadTasks();
  } catch (err) {
    showPopup(serverError(err));
  } finally {
    modalSave.disabled = false;
    modalSave.textContent = "Save changes";
  }
});

function askDelete(id) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  showConfirm(
    `"${t.title}" (${t.id}) will be removed from ${t.username}'s task list and the sheet. This can't be undone.`,
    { title: "Delete this task?", yesLabel: "Yes, delete", noLabel: "Keep it" },
    async () => {
      try {
        const res = await callSheet({ action: "deleteTask", id });
        if (res.status !== "success") throw new Error(res.message);
        if (editingId === id) closeEdit();
        showPopup(`Task ${id} deleted.`, "success");
        await loadTasks();
      } catch (err) {
        showPopup(serverError(err));
      }
    }
  );
}

// ---------- Events ----------
$("taskRows").addEventListener("click", (e) => {
  const edit = e.target.closest("[data-edit]");
  const del = e.target.closest("[data-delete]");
  if (edit) openEdit(edit.dataset.edit);
  if (del) askDelete(del.dataset.delete);
});
$("teamSummary").addEventListener("click", (e) => {
  const chip = e.target.closest(".sum-chip");
  if (!chip) return;
  $("statusFilter").value = chip.dataset.status;
  render();
});
$("modalCancel").addEventListener("click", closeEdit);
$("modalClose").addEventListener("click", closeEdit);
$("modalDelete").addEventListener("click", () => editingId && askDelete(editingId));
modal.addEventListener("click", (e) => { if (e.target === modal) closeEdit(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal.classList.contains("show") && !$("popup").classList.contains("show")) closeEdit();
});
["search", "personFilter", "statusFilter"].forEach((id) => $(id).addEventListener(id === "search" ? "input" : "change", render));
refreshBtn.addEventListener("click", loadTasks);
setInterval(() => lastSync && (syncText.textContent = "Last sync: " + timeAgo(lastSync)), 30000);

if (IS_ADMIN) loadTasks();
