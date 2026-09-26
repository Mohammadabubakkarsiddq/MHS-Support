// =============================================================
// Add Task page (add-task.html)
// =============================================================
const addForm = document.getElementById("taskForm");
const saveBtn = document.getElementById("saveBtn");

buildTaskForm(addForm.querySelector(".form-fields"), "add");
resetTaskForm(addForm);

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const task = readTaskForm(addForm);
  if (!task) return;

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";
  try {
    const res = await callSheet({ action: "addTask", name: CURRENT_USER, task });
    if (res.status !== "success") throw new Error(res.message);
    showPopup(`Task saved as ${res.id}. You can see it in View & Edit Task.`, "success");
    resetTaskForm(addForm);
  } catch (err) {
    showPopup(serverError(err));
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save task";
  }
});

document.getElementById("clearBtn").addEventListener("click", () => resetTaskForm(addForm));
