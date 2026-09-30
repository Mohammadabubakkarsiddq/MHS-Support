// =============================================================
// Shared reminder form (Add Reminder page + edit window)
// Load AFTER shell.js and task-form.js
// =============================================================
const REMINDER_FIELDS = ["description", "priority", "category", "first", "second", "final", "notes"];

function buildReminderForm(container, idPrefix) {
  const id = (name) => `${idPrefix}-${name}`;
  container.innerHTML = `
    <div class="field">
      <label for="${id("description")}">Reminder description <span class="req">*</span></label>
      <textarea id="${id("description")}" name="description" rows="3" maxlength="500" placeholder="What do you need to be reminded about?"></textarea>
    </div>
    <div class="row-2">
      <div class="field">
        <label for="${id("category")}">Category</label>
        <select id="${id("category")}" name="category">${optionsHTML(REMINDER_CATEGORIES, "Meeting")}</select>
      </div>
      <div class="field">
        <label for="${id("priority")}">Priority</label>
        <select id="${id("priority")}" name="priority">${optionsHTML(PRIORITIES, "Medium")}</select>
      </div>
    </div>
    <div class="row-3">
      <div class="field">
        <label for="${id("first")}">1st reminder <span class="req">*</span></label>
        <input type="date" id="${id("first")}" name="first" />
      </div>
      <div class="field">
        <label for="${id("second")}">2nd reminder</label>
        <input type="date" id="${id("second")}" name="second" />
      </div>
      <div class="field">
        <label for="${id("final")}">Final reminder <span class="req">*</span></label>
        <input type="date" id="${id("final")}" name="final" />
      </div>
    </div>
    <div class="field">
      <label for="${id("notes")}">Notes</label>
      <textarea id="${id("notes")}" name="notes" rows="2" placeholder="People involved, links, what to check"></textarea>
    </div>`;
}

function resetReminderForm(form) {
  form.reset();
  form.elements.first.value = toISO(new Date());
  form.elements.priority.value = "Medium";
  form.elements.category.value = "Meeting";
  clearInvalid(form);
}

function fillReminderForm(form, r) {
  REMINDER_FIELDS.forEach((f) => {
    const el = form.elements[f];
    const value = r[f] || "";
    if (el.tagName === "SELECT" && value && ![...el.options].some((o) => o.value === value)) {
      el.add(new Option(value, value));
    }
    el.value = value;
  });
  clearInvalid(form);
}

function readReminderForm(form) {
  clearInvalid(form);
  const r = {};
  REMINDER_FIELDS.forEach((f) => (r[f] = form.elements[f].value.trim()));
  const fail = (field, msg) => { form.elements[field].classList.add("invalid"); form.elements[field].focus(); showPopup(msg); return null; };

  if (!r.description) return fail("description", "Enter a reminder description.");
  if (!r.first) return fail("first", "Choose the 1st reminder date.");
  if (!r.final) return fail("final", "Choose the final reminder date.");
  if (r.second && r.second < r.first) return fail("second", "2nd reminder can't be before the 1st reminder.");
  if (r.final < (r.second || r.first)) return fail("final", "Final reminder can't be before the earlier reminders.");
  return r;
}
