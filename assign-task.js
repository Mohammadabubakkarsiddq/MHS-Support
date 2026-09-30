// =============================================================
// Assign Task page (assign-task.html) — admins only
// =============================================================
const assignForm = document.getElementById("assignForm");
const assigneeSelect = document.getElementById("assignee");
const assignBtn = document.getElementById("assignBtn");

buildTaskForm(assignForm.querySelector(".form-fields"), "assign");
resetTaskForm(assignForm);

async function loadEmployees() {
  assigneeSelect.innerHTML = `<option value="">Loading employees...</option>`;
  try {
    const res = await callSheet({ action: "getEmployees" });
    if (res.status !== "success") throw new Error(res.message);
    assigneeSelect.innerHTML = res.employees.length
      ? `<option value="">Choose an employee</option>` +
        res.employees.map((p) => `<option value="${esc(p.name)}">${esc(p.name)}${p.role === "Admin" ? " (Admin)" : ""}</option>`).join("")
      : `<option value="">No other users have signed up yet</option>`;
    const preset = new URLSearchParams(location.search).get("to");
    if (preset) assigneeSelect.value = preset;
  } catch (err) {
    assigneeSelect.innerHTML = `<option value="">Could not load employees</option>`;
    showPopup(serverError(err));
  }
}

assignForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  assigneeSelect.classList.remove("invalid");
  if (!assigneeSelect.value) {
    assigneeSelect.classList.add("invalid");
    assigneeSelect.focus();
    return showPopup("Choose the employee this task is for.");
  }
  const task = readTaskForm(assignForm);
  if (!task) return;

  assignBtn.disabled = true;
  assignBtn.textContent = "Assigning...";
  try {
    const res = await callSheet({ action: "assignTask", assignee: assigneeSelect.value, task });
    if (res.status !== "success") throw new Error(res.message);
    showPopup(`Task ${res.id} assigned to ${res.assignee}. It's now in their task list.`, "success");
    const keep = assigneeSelect.value;
    resetTaskForm(assignForm);
    assigneeSelect.value = keep; // handy when assigning several tasks to the same person
  } catch (err) {
    showPopup(serverError(err));
  } finally {
    assignBtn.disabled = false;
    assignBtn.textContent = "Assign task";
  }
});

document.getElementById("clearBtn").addEventListener("click", () => {
  resetTaskForm(assignForm);
  assigneeSelect.value = "";
});

if (IS_ADMIN) loadEmployees();
