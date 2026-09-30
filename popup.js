// =============================================================
// Video pop-ups. Load AFTER script.js — replaces the plain
// showPopup() with one that plays the character videos:
//   popup-error.mp4    → general errors
//   popup-login.mp4    → wrong mail ID / password
//   popup-success.mp4  → saved, updated, done
//   popup-reminder.mp4 → reminders due today
// The .png pictures are the backup if a video can't play.
// =============================================================
(function loadPopupCss() {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "popup.css";
  document.head.appendChild(link);
})();

const POPUP_KINDS = {
  error:    { video: "popup-error.mp4",    poster: "popup-error.jpg",    img: "popup-error.png",
              label: "Error",                      button: "OK, I'll fix it" },
  login:    { video: "popup-login.mp4",    poster: "popup-login.jpg",    img: "popup-login.png",
              label: "Incorrect User or Password", button: "Try again" },
  success:  { video: "popup-success.mp4",  poster: "popup-success.jpg",  img: "popup-success.png",
              label: "Done Successfully",          button: "OK" },
  reminder: { video: "popup-reminder.mp4", poster: "popup-reminder.jpg", img: "popup-reminder.png",
              label: "Reminder",                   button: "OK" },
};
const LABEL_ICONS = {
  error:    '<svg viewBox="0 0 24 24"><path d="M12 7v6"/><circle cx="12" cy="17" r="0.6"/></svg>',
  login:    '<svg viewBox="0 0 24 24"><path d="M8 8l8 8M16 8l-8 8"/></svg>',
  success:  '<svg viewBox="0 0 24 24"><path d="M7 12.5l3.2 3.2L17 9"/></svg>',
  reminder: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
};
const REDUCED_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Warm up the videos and posters in the background so pop-ups open instantly
window.addEventListener("load", () => {
  setTimeout(() => {
    Object.values(POPUP_KINDS).forEach((k) => {
      new Image().src = k.poster;
      if (!REDUCED_MOTION) fetch(k.video).catch(() => {});
    });
  }, 1200);
});

function preparePopup(kind) {
  const box = document.getElementById("popupBox");
  const cfg = POPUP_KINDS[kind] || POPUP_KINDS.error;

  if (!box.querySelector(".pp-art")) {
    box.classList.add("popup-anime");
    box.insertAdjacentHTML("afterbegin", `
      <div class="pp-art">
        <video muted playsinline loop preload="auto" aria-hidden="true"></video>
        <img class="pp-fallback" alt="" hidden />
      </div>
      <div class="pp-label"><span class="pp-label-ico"></span><span class="pp-label-text"></span></div>
      <h2 class="pp-title"></h2>`);
    document.getElementById("popupText").insertAdjacentHTML("afterend", `<div class="pp-list" hidden></div>`);

    // If a video can't play, show the picture instead (it has its own label)
    const video = box.querySelector(".pp-art video");
    video.addEventListener("error", () => useFallback(box), true);
  }

  const video = box.querySelector(".pp-art video");
  const fallback = box.querySelector(".pp-fallback");
  box.classList.remove("pp-no-video");
  video.hidden = false;
  fallback.hidden = true;
  fallback.src = cfg.img;
  fallback.alt = cfg.label;
  video.poster = cfg.poster;
  if (!video.src.endsWith(cfg.video)) video.src = cfg.video;
  try { video.currentTime = 0; } catch (e) {}
  if (!REDUCED_MOTION) {
    const playing = video.play();
    if (playing) playing.catch(() => {}); // the poster frame shows if autoplay is blocked
  }

  box.querySelector(".pp-label-ico").innerHTML = LABEL_ICONS[kind] || LABEL_ICONS.error;
  box.querySelector(".pp-label-text").textContent = cfg.label;
  box.querySelector(".pp-title").textContent = cfg.label;
  box.querySelector(".pp-list").hidden = true;

  Object.keys(POPUP_KINDS).forEach((k) => box.classList.toggle("pp-" + k, k === kind));
  box.classList.toggle("success", kind === "success");
  box.classList.remove("pp-show-title");

  const closeBtn = document.getElementById("popupClose");
  closeBtn.textContent = cfg.button;
  closeBtn.classList.remove("pp-danger");
  const cancelBtn = document.getElementById("popupCancel");
  if (cancelBtn) cancelBtn.hidden = true;

  // Restart the entrance animation every time
  box.classList.remove("pp-in");
  void box.offsetWidth;
  box.classList.add("pp-in");
  return box;
}

function useFallback(box) {
  box.querySelector(".pp-art video").hidden = true;
  box.querySelector(".pp-fallback").hidden = false;
  box.classList.add("pp-no-video");
}

function stopPopupVideo() {
  const video = document.querySelector("#popupBox .pp-art video");
  if (video) video.pause();
}

// kind: "error" (default), "success", "login", "reminder"
function showPopup(message, kind = "error", onClose) {
  const popup = document.getElementById("popup");
  const closeBtn = document.getElementById("popupClose");
  preparePopup(kind);
  document.getElementById("popupText").textContent = message;
  popup.classList.add("show");
  closeBtn.focus();

  const close = () => {
    popup.classList.remove("show");
    stopPopupVideo();
    document.removeEventListener("keydown", onKey);
    popup.onclick = null;
    if (onClose) onClose();
  };
  const onKey = (e) => { if (e.key === "Escape") close(); };

  closeBtn.onclick = close;
  popup.onclick = (e) => { if (e.target === popup) close(); };
  if (popup._ppKey) document.removeEventListener("keydown", popup._ppKey);
  popup._ppKey = onKey;
  setTimeout(() => document.addEventListener("keydown", onKey), 0);
}

// Adds a second button (used by confirm + reminder pop-ups)
function ensureCancelButton() {
  const closeBtn = document.getElementById("popupClose");
  let cancelBtn = document.getElementById("popupCancel");
  if (!cancelBtn) {
    const row = document.createElement("div");
    row.className = "pp-actions";
    closeBtn.replaceWith(row);
    cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.id = "popupCancel";
    cancelBtn.className = "pp-cancel";
    row.append(cancelBtn, closeBtn);
  }
  return cancelBtn;
}

// ---------- Yes / No confirmation (delete, close) ----------
// opts: { title, yesLabel, noLabel, kind, danger }
function showConfirm(message, opts, onYes) {
  const { title = "Are you sure?", yesLabel = "Yes", noLabel = "Cancel", kind = "error", danger = true } = opts || {};
  const closeBtn = document.getElementById("popupClose");
  const cancelBtn = ensureCancelButton();

  let confirmed = false;
  showPopup(message, kind, () => { if (confirmed && onYes) onYes(); });

  document.querySelector("#popupBox .pp-title").textContent = title;
  document.querySelector("#popupBox").classList.add("pp-show-title");
  closeBtn.textContent = yesLabel;
  closeBtn.classList.toggle("pp-danger", danger);
  cancelBtn.textContent = noLabel;
  cancelBtn.hidden = false;
  cancelBtn.focus();

  const baseClose = closeBtn.onclick;
  closeBtn.onclick = () => { confirmed = true; baseClose(); };
  cancelBtn.onclick = () => { confirmed = false; baseClose(); };
}

// ---------- Reminders due today (shown after login) ----------
// items: [{ id, description, stage, state, date }]
function showReminderPopup(items, onView) {
  const closeBtn = document.getElementById("popupClose");
  const cancelBtn = ensureCancelButton();
  let goView = false;

  const today = items.filter((i) => i.state === "today").length;
  const late = items.length - today;
  const summary = [
    today ? `${today} reminder${today === 1 ? " is" : "s are"} due today` : "",
    late ? `${late} ${late === 1 ? "is" : "are"} overdue` : "",
  ].filter(Boolean).join(" and ") + ".";

  showPopup(summary, "reminder", () => { if (goView && onView) onView(); });
  const box = document.getElementById("popupBox");
  box.classList.remove("pp-show-title");

  const list = box.querySelector(".pp-list");
  list.innerHTML = "";
  items.slice(0, 4).forEach((i) => {
    const row = document.createElement("div");
    row.className = "pp-item " + (i.state === "overdue" ? "late" : "today");
    const text = document.createElement("span");
    text.className = "pp-item-text";
    text.textContent = i.description;
    const tag = document.createElement("span");
    tag.className = "pp-item-tag";
    tag.textContent = i.state === "overdue" ? "Overdue" : `${i.stage} reminder`;
    row.append(text, tag);
    list.append(row);
  });
  if (items.length > 4) {
    const more = document.createElement("p");
    more.className = "pp-more";
    more.textContent = `+ ${items.length - 4} more`;
    list.append(more);
  }
  list.hidden = false;

  closeBtn.textContent = "View reminders";
  cancelBtn.textContent = "Later";
  cancelBtn.hidden = false;
  closeBtn.focus();

  const baseClose = closeBtn.onclick;
  closeBtn.onclick = () => { goView = true; baseClose(); };
  cancelBtn.onclick = () => { goView = false; baseClose(); };
}
