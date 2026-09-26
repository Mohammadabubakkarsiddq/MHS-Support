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
  // text/plain avoids the browser's CORS pre-check, which Apps Script can't answer
  const response = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(data),
  });
  return response.json();
}

// =============================================================
// SIGNUP PAGE
// =============================================================
const signupForm = document.getElementById("signupForm");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const number = document.getElementById("number").value.trim();
    const email = document.getElementById("email").value.trim();
    const pass = document.getElementById("newPassword");
    const confirm = document.getElementById("confirmPassword");

    document.querySelectorAll("input").forEach((i) => i.classList.remove("invalid"));

    if (!name || !number || !email || !pass.value || !confirm.value) {
      return showPopup("Fill in all the fields to create your account.");
    }
    if (!/^[0-9]{10}$/.test(number)) {
      document.getElementById("number").classList.add("invalid");
      return showPopup("Mobile number must be 10 digits.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      document.getElementById("email").classList.add("invalid");
      return showPopup("Enter a valid mail ID, like name@example.com.");
    }
    if (pass.value.length < 8) {
      pass.classList.add("invalid");
      return showPopup("Password must be at least 8 characters.");
    }
    if (pass.value !== confirm.value) {
      confirm.classList.add("invalid");
      return showPopup("Create password and confirm password do not match.");
    }

    const btn = document.getElementById("signupBtn");
    btn.disabled = true;
    btn.textContent = "Creating account...";

    try {
      const result = await callSheet({
        action: "signup",
        name, number, email,
        password: pass.value,
      });

      if (result.status === "success") {
        showPopup("Account created. Log in with your name and password.", "success", () => {
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
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !password) {
      return showPopup("Enter your username and password.");
    }

    const btn = document.getElementById("loginBtn");
    btn.disabled = true;
    btn.textContent = "Logging in...";

    try {
      const result = await callSheet({ action: "login", name: username, password });

      if (result.status === "success") {
        sessionStorage.setItem("username", result.name);
        window.location.href = "home.html";
      } else {
        showPopup(result.message);
      }
    } catch (err) {
      showPopup("Could not reach the server. Check the SCRIPT_URL in script.js.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Log in";
    }
  });
}
