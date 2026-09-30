// =============================================================
// Add Reminder page (add-reminder.html)
// =============================================================
const remForm = document.getElementById("reminderForm");
const saveBtn = document.getElementById("saveBtn");

buildReminderForm(remForm.querySelector(".form-fields"), "add");
resetReminderForm(remForm);

remForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const reminder = readReminderForm(remForm);
  if (!reminder) return;

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";
  try {
    const res = await callSheet({ action: "addReminder", name: CURRENT_USER, reminder });
    if (res.status !== "success") throw new Error(res.message);
    showPopup(`Reminder saved as ${res.id}. You can see it in View Reminders and on your dashboard.`, "success");
    resetReminderForm(remForm);
  } catch (err) {
    showPopup(serverError(err));
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save reminder";
  }
});

document.getElementById("clearBtn").addEventListener("click", () => resetReminderForm(remForm));
