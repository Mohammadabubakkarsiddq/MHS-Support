// =============================================================
// Forgot password (forgot-password.html) and set new password (reset-password.html)
// =============================================================
(function () {
  const $ = (id) => document.getElementById(id);

  // ---------- Step 1: ask for the mail ID, send the reset mail ----------
  const forgotForm = $("forgotForm");
  if (forgotForm) {
    const lastEmail = sessionStorage.getItem("lastEmail");
    if (lastEmail) $("email").value = lastEmail;

    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("email").value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        $("email").classList.add("invalid");
        $("email").focus();
        return showPopup("Enter a valid mail ID.");
      }
      $("email").classList.remove("invalid");
      const btn = $("forgotBtn");
      btn.disabled = true;
      btn.textContent = "Sending...";
      try {
        const res = await callSheet({ action: "requestPasswordReset", email });
        if (res.status !== "success") return showPopup(res.message);
        $("sentTo").textContent = email;
        forgotForm.hidden = true;
        $("sentNote").hidden = false;
      } catch (err) {
        showPopup(err instanceof TypeError ? "Could not reach the server. Check your internet connection and try again." : err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = "Send reset link";
      }
    });

    $("resendBtn").addEventListener("click", () => {
      $("sentNote").hidden = true;
      forgotForm.hidden = false;
      $("email").focus();
    });
  }

  // ---------- Step 2: opened from the mail link, set a new password ----------
  const resetForm = $("resetForm");
  if (resetForm) {
    const pass = $("newPassword");
    const confirm = $("confirmPassword");
    const matchNote = $("matchNote");

    const updateMatch = () => {
      if (!confirm.value) { matchNote.textContent = ""; matchNote.className = "match-note"; return; }
      const same = confirm.value === pass.value;
      matchNote.textContent = same ? "Passwords match" : "Passwords don't match yet";
      matchNote.className = "match-note " + (same ? "ok" : "bad");
    };
    pass.addEventListener("input", () => {
      document.querySelectorAll("#pwRules li").forEach((li) => li.classList.toggle("ok", PASSWORD_RULES[li.dataset.rule](pass.value)));
      updateMatch();
    });
    confirm.addEventListener("input", updateMatch);

    // Is the link valid?
    callSheet({ action: "checkResetLink" }).then((res) => {
      if (res.status === "success") {
        $("resetSubtitle").textContent = `Choose a new password for ${res.email}.`;
        resetForm.hidden = false;
        pass.focus();
      } else {
        $("resetSubtitle").textContent = "";
        $("linkProblemText").textContent = res.message;
        $("linkProblem").hidden = false;
      }
    }).catch(() => {
      $("resetSubtitle").textContent = "";
      $("linkProblemText").textContent = "Could not reach the server. Check your internet connection and reload this page.";
      $("linkProblem").hidden = false;
    });

    resetForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const missing = Object.keys(PASSWORD_RULES).filter((k) => !PASSWORD_RULES[k](pass.value));
      if (missing.length) { pass.focus(); return showPopup("Your password needs " + missing.map((k) => RULE_TEXT[k]).join(", ") + "."); }
      if (pass.value !== confirm.value) { confirm.focus(); return showPopup("New password and confirm password do not match."); }

      const btn = $("resetBtn");
      btn.disabled = true;
      btn.textContent = "Saving...";
      try {
        const res = await callSheet({ action: "resetPassword", password: pass.value });
        if (res.status !== "success") return showPopup(res.message);
        showPopup("Password changed! Log in with your new password.", "success", () => window.location.replace("index.html"));
      } catch (err) {
        showPopup(err instanceof TypeError ? "Could not reach the server. Check your internet connection and try again." : err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = "Change password";
      }
    });
  }
})();
