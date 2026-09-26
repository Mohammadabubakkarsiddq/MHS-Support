// =============================================================
// View & Edit Task page (view-tasks.html)
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
let handledLink = false;

buildTaskForm(editForm.querySelector(".form-fields"), "edit");

async function loadTasks() {
  syncText.textContent = "Loading tasks...";
  refreshBtn.classList.add("spinning");
  try {
    tasks = await fetchMyTasks();
    lastSync = new Date();
    syncText.textContent = "Last sync: " + timeAgo(lastSync);
    renderTable();

    // Opened from the dashboard, e.g. view-tasks.html?edit=TSK-0003
    const editParam = new URLSearchParams(location.search).get("edit");
    if (editParam && !handledLink) {
      handledLink = true;
      openEdit(editParam);
    }
  } catch (err) {
    syncText.textContent = "Could not load tasks";
    showPopup(serverError(err));
  } finally {
    refreshBtn.classList.remove("spinning");
  }
}

function renderTable() {
  const q = $("search").value.trim().toLowerCase();
  const status = $("statusFilter").value;
  const list = tasks
    .filter((t) => !status || t.status === status)
    .filter((t) => !q || [t.id, t.title, t.category].some((v) => String(v).toLowerCase().includes(q)))
    .sort((a, b) => (b.updatedOn || "").localeCompare(a.updatedOn || ""));

  $("taskCount").textContent = `${list.length} of ${tasks.length} task${tasks.length === 1 ? "" : "s"}`;

  if (!list.length) {
    $("taskRows").innerHTML = `<tr class="empty-row"><td colspan="8">${
      tasks.length ? "No tasks match this search." : `No tasks yet. <a href="add-task.html">Add your first task</a>`
    }</td></tr>`;
    return;
  }
  $("taskRows").innerHTML = list.map((t) => `
    <tr>
      <td class="nowrap muted">${esc(t.id)}</td>
      <td class="title-cell">${esc(t.title)}${t.category ? `<br><span class="muted">${esc(t.category)}</span>` : ""}</td>
      <td class="prio-${esc(t.priority)}">${esc(t.priority)}</td>
      <td>${statusBadge(t.status)}</td>
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
  if (!t) return showPopup(`Task ${id} was not found. It may have been deleted.`);
  editingId = id;
  fillTaskForm(editForm, t);
  $("modalTitle").textContent = `Edit task ${id}`;
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
    const res = await callSheet({ action: "updateTask", name: CURRENT_USER, id: editingId, task });
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

// ---------- Delete ----------
function askDelete(id) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  showConfirm(
    `"${t.title}" (${t.id}) will be removed from the sheet. This can't be undone.`,
    { title: "Delete this task?", yesLabel: "Yes, delete", noLabel: "Keep it" },
    async () => {
      try {
        const res = await callSheet({ action: "deleteTask", name: CURRENT_USER, id });
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
$("modalCancel").addEventListener("click", closeEdit);
$("modalClose").addEventListener("click", closeEdit);
$("modalDelete").addEventListener("click", () => editingId && askDelete(editingId));
modal.addEventListener("click", (e) => { if (e.target === modal) closeEdit(); });
document.addEventListener("keydown", (e) => {
  const popupOpen = $("popup").classList.contains("show");
  if (e.key === "Escape" && modal.classList.contains("show") && !popupOpen) closeEdit();
});
$("search").addEventListener("input", renderTable);
$("statusFilter").addEventListener("change", renderTable);
refreshBtn.addEventListener("click", loadTasks);
setInterval(() => lastSync && (syncText.textContent = "Last sync: " + timeAgo(lastSync)), 30000);

if (CURRENT_USER) loadTasks();
