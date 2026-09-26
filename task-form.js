// =============================================================
// Shared task form (used by Add Task and View & Edit Task)
// Load AFTER shell.js
// =============================================================
const CATEGORIES = ["Audit & Compliance", "IT & Assets", "Operations", "Marketing", "Reporting", "Meetings", "Other"];
const PRIORITIES = ["High", "Medium", "Low"];
const TASK_FIELDS = ["title", "description", "category", "priority", "status", "startDate", "dueDate", "remarks"];

function optionsHTML(list, selected) {
  return list.map((v) => `<option${v === selected ? " selected" : ""}>${esc(v)}</option>`).join("");
}

// Puts the form fields inside a <form> element
function buildTaskForm(form, idPrefix) {
  const id = (name) => `${idPrefix}-${name}`;
  form.innerHTML = `
    <div class="field">
      <label for="${id("title")}">Task title <span class="req">*</span></label>
      <input type="text" id="${id("title")}" name="title" maxlength="150" placeholder="What needs to be done?" />
    </div>
    <div class="field">
      <label for="${id("description")}">Description</label>
      <textarea id="${id("description")}" name="description" rows="3" placeholder="Details, links or steps"></textarea>
    </div>
    <div class="row-2">
      <div class="field">
        <label for="${id("category")}">Category</label>
        <select id="${id("category")}" name="category">${optionsHTML(CATEGORIES)}</select>
      </div>
      <div class="field">
        <label for="${id("priority")}">Priority</label>
        <select id="${id("priority")}" name="priority">${optionsHTML(PRIORITIES, "Medium")}</select>
      </div>
    </div>
    <div class="row-2">
      <div class="field">
        <label for="${id("status")}">Status</label>
        <select id="${id("status")}" name="status">${optionsHTML(STATUS_LIST, "Not Started")}</select>
      </div>
      <div class="field">
        <label for="${id("startDate")}">Start date <span class="req">*</span></label>
        <input type="date" id="${id("startDate")}" name="startDate" />
      </div>
    </div>
    <div class="row-2">
      <div class="field">
        <label for="${id("dueDate")}">Due date</label>
        <input type="date" id="${id("dueDate")}" name="dueDate" />
      </div>
      <div class="field"></div>
    </div>
    <div class="field">
      <label for="${id("remarks")}">Remarks</label>
      <textarea id="${id("remarks")}" name="remarks" rows="2" placeholder="Progress notes, reason for hold or cancel, etc."></textarea>
    </div>`;
}

function clearInvalid(form) {
  form.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
}

function resetTaskForm(form) {
  form.reset();
  form.elements.startDate.value = toISO(new Date());
  form.elements.priority.value = "Medium";
  form.elements.status.value = "Not Started";
  clearInvalid(form);
}

function fillTaskForm(form, task) {
  TASK_FIELDS.forEach((f) => {
    const el = form.elements[f];
    const value = task[f] || "";
    // Keep values typed directly in the sheet that aren't in the dropdown list
    if (el.tagName === "SELECT" && value && ![...el.options].some((o) => o.value === value)) {
      el.add(new Option(value, value));
    }
    el.value = value;
  });
  clearInvalid(form);
}

// Returns the task object, or null (and shows a pop-up) if something is missing
function readTaskForm(form) {
  clearInvalid(form);
  const task = {};
  TASK_FIELDS.forEach((f) => (task[f] = form.elements[f].value.trim()));
  const fail = (field, msg) => { form.elements[field].classList.add("invalid"); form.elements[field].focus(); showPopup(msg); return null; };

  if (!task.title) return fail("title", "Enter a task title.");
  if (!task.startDate) return fail("startDate", "Choose a start date.");
  if (task.dueDate && task.dueDate < task.startDate) return fail("dueDate", "Due date can't be before the start date.");
  return task;
}
