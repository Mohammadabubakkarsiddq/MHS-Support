// =============================================================
// STEP 1: Paste your Google Apps Script Web App URL here
// (see README.md for how to get it)
// =============================================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbztd0F_2vTblNOxiExnoFFZsyaLhKmPLP6s4GsG7mRP2In0nnIqG51877J-KBFJK6Gn/exec";

// ---------- Pop-up helper ----------
function showPopup(message, type = "error", onClose) {
  const popup = document.getElementById("popup");
  const box = document.getElementById("popupBox");
  document.getElementById("popupText").textContent = message;
  box.classList.toggle("success", type === "success");
  popup.classList.add("show");

  const closeBtn = document.getElementById("popupClose");
  closeBtn.focus();
  closeBtn.onclick = () => {
    popup.classList.remove("show");
    if (onClose) onClose();
  };
}

// ---------- Send data to Google Sheets ----------
async function callSheet(data) {
  // The login token proves who you are; the sheet ignores any name sent by the page
  const token = sessionStorage.getItem("token");
  // text/plain avoids the browser's CORS pre-check, which Apps Script can't answer
  const response = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(token ? { ...data, token } : data),
  });
  const result = await response.json();

  // Session expired or missing: back to the login page
  if (result.code === "AUTH") {
    sessionStorage.clear();
    window.location.replace("index.html?expired=1");
    return new Promise(() => {}); // stop the calling code here
  }
  return result;
}

// ---------- Show / hide password ----------
document.querySelectorAll("[data-toggle]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.toggle);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    btn.style.color = show ? "#6b2fb3" : "";
  });
});

const PASSWORD_RULES = {
  len: (p) => p.length >= 8,
  upper: (p) => /[A-Z]/.test(p),
  lower: (p) => /[a-z]/.test(p),
  num: (p) => /[0-9]/.test(p),
  special: (p) => /[^A-Za-z0-9]/.test(p),
};
const RULE_TEXT = {
  len: "at least 8 characters", upper: "an uppercase letter", lower: "a lowercase letter",
  num: "a number", special: "a special character",
};

// =============================================================
// SIGNUP PAGE
// =============================================================
const signupForm = document.getElementById("signupForm");
if (signupForm) {
  const $ = (id) => document.getElementById(id);
  const pass = $("newPassword");
  const confirm = $("confirmPassword");
  const matchNote = $("matchNote");

  const updateRules = () => {
    document.querySelectorAll("#pwRules li").forEach((li) =>
      li.classList.toggle("ok", PASSWORD_RULES[li.dataset.rule](pass.value)));
    updateMatch();
  };
  const updateMatch = () => {
    if (!confirm.value) { matchNote.textContent = ""; matchNote.className = "match-note"; return; }
    const same = confirm.value === pass.value;
    matchNote.textContent = same ? "Passwords match" : "Passwords don't match yet";
    matchNote.className = "match-note " + (same ? "ok" : "bad");
  };
  pass.addEventListener("input", updateRules);
  confirm.addEventListener("input", updateMatch);
  $("number").addEventListener("input", (e) => (e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10)));
  $("cancelBtn").addEventListener("click", () => (window.location.href = "index.html"));

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    signupForm.querySelectorAll(".invalid").forEach((i) => i.classList.remove("invalid"));
    const fail = (el, msg) => { el.classList.add("invalid"); el.focus(); showPopup(msg); };

    const name = $("name").value.trim();
    const email = $("email").value.trim().toLowerCase();
    const number = $("number").value.trim();
    const role = signupForm.querySelector("input[name=role]:checked").value;

    if (name.length < 2) return fail($("name"), "Enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail($("email"), "Enter a valid mail ID, like name@example.com.");
    if (!/^[0-9]{10}$/.test(number)) return fail($("number"), "Mobile number must be 10 digits.");
    const missing = Object.keys(PASSWORD_RULES).filter((k) => !PASSWORD_RULES[k](pass.value));
    if (missing.length) return fail(pass, "Your password needs " + missing.map((k) => RULE_TEXT[k]).join(", ") + ".");
    if (pass.value !== confirm.value) return fail(confirm, "Password and confirm password do not match.");

    const btn = $("signupBtn");
    btn.disabled = true;
    btn.textContent = "Creating account...";
    try {
      const result = await callSheet({ action: "signup", name, email, number, role, password: pass.value });
      if (result.status === "success") {
        sessionStorage.setItem("lastEmail", email);
        showPopup("Account created! Log in with your mail ID and password.", "success", () => {
          window.location.href = "index.html";
        });
      } else {
        showPopup(result.message);
      }
    } catch (err) {
      showPopup("Could not reach the server. Check the SCRIPT_URL in script.js.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Sign up";
    }
  });
}

// =============================================================
// LOGIN PAGE
// =============================================================
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  const emailInput = document.getElementById("email");
  const lastEmail = sessionStorage.getItem("lastEmail");
  if (lastEmail) {
    emailInput.value = lastEmail;
    document.getElementById("password").focus();
  }
  if (new URLSearchParams(location.search).get("expired")) {
    setTimeout(() => showPopup("Your session has expired. Please log in again."), 0);
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = document.getElementById("password").value;
    if (!email || !password) return showPopup("Enter your mail ID and password.");

    const btn = document.getElementById("loginBtn");
    btn.disabled = true;
    btn.textContent = "Logging in...";
    try {
      const result = await callSheet({ action: "login", email, password });
      if (result.status === "success") {
        sessionStorage.clear();
        sessionStorage.setItem("username", result.name);
        sessionStorage.setItem("role", result.role);
        sessionStorage.setItem("email", result.email || "");
        sessionStorage.setItem("number", result.number || "");
        sessionStorage.setItem("token", result.token);
        window.location.href = "home.html";
      } else {
        showPopup(result.message, /incorrect/i.test(result.message) ? "login" : "error");
      }
    } catch (err) {
      showPopup("Could not reach the server. Check the SCRIPT_URL in script.js.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Login";
    }
  });
}
