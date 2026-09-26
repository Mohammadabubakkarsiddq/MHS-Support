// =============================================================
// Animated anime-girl pop-up. Load AFTER script.js —
// it replaces the plain showPopup() with this animated one.
// =============================================================
(function loadPopupCss() {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "popup.css";
  document.head.appendChild(link);
})();

function popupGirl(mood) {
  const happy = mood === "success";
  const hair = "#4b2170";

  const eyes = happy
    ? `<path d="M56 100 q8 -10 16 0" stroke="#2a1740" stroke-width="3" fill="none" stroke-linecap="round"/>
       <path d="M88 100 q8 -10 16 0" stroke="#2a1740" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : `<g class="pp-eyes">
         <ellipse cx="64" cy="99" rx="9" ry="11" fill="#fff"/>
         <ellipse cx="64" cy="100" rx="7" ry="9" fill="#6a34a0"/>
         <ellipse cx="64" cy="101" rx="3.6" ry="4.6" fill="#2a1740"/>
         <circle cx="61" cy="96" r="2.6" fill="#fff"/><circle cx="67" cy="104" r="1.2" fill="#fff"/>
         <ellipse cx="96" cy="99" rx="9" ry="11" fill="#fff"/>
         <ellipse cx="96" cy="100" rx="7" ry="9" fill="#6a34a0"/>
         <ellipse cx="96" cy="101" rx="3.6" ry="4.6" fill="#2a1740"/>
         <circle cx="93" cy="96" r="2.6" fill="#fff"/><circle cx="99" cy="104" r="1.2" fill="#fff"/>
       </g>`;

  const brows = happy
    ? `<path d="M56 85 q8 -4 15 0" stroke="${hair}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
       <path d="M89 85 q8 -4 15 0" stroke="${hair}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
    : `<path d="M56 86 L70 81" stroke="${hair}" stroke-width="2.6" stroke-linecap="round"/>
       <path d="M90 81 L104 86" stroke="${hair}" stroke-width="2.6" stroke-linecap="round"/>`;

  const mouth = happy
    ? `<path d="M72 114 q8 9 16 0 z" fill="#b8475e"/>`
    : `<ellipse cx="80" cy="119" rx="4" ry="3.6" fill="#b8475e"/>`;

  const extras = happy
    ? `<path class="pp-spark" d="M24 40 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#f5b83d"/>
       <path class="pp-spark s2" d="M136 34 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#c9a8ef"/>
       <path class="pp-spark s3" d="M140 112 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#1f9d55"/>`
    : `<path class="pp-sweat" d="M122 66 C126 74 128 78 128 81 a6 6 0 0 1 -12 0 C116 78 118 74 122 66 Z"
             fill="#9ad8ff" stroke="#4aa8e0" stroke-width="1.2"/>
       <text class="pp-mark" x="128" y="52" font-size="26" font-weight="900" fill="#d9365a"
             font-family="Arial, sans-serif">!</text>`;

  return `
  <svg viewBox="0 0 160 160" aria-hidden="true">
    <g class="pp-girl">
      <path d="M50 160 C52 140 64 130 80 130 C96 130 108 140 110 160 Z" fill="#5b2a86"/>
      <path d="M70 131 L80 142 L90 131 Z" fill="#fff"/>
      <g class="pp-head">
        <path class="pp-tail-l" d="M42 72 C18 78 12 112 22 136 C31 122 35 104 46 92 Z" fill="${hair}"/>
        <path class="pp-tail-r" d="M118 72 C142 78 148 112 138 136 C129 122 125 104 114 92 Z" fill="${hair}"/>
        <ellipse cx="80" cy="82" rx="47" ry="45" fill="${hair}"/>
        <ellipse cx="80" cy="92" rx="40" ry="38" fill="#ffe6d8"/>
        <path d="M38 92 C34 58 56 40 80 40 C104 40 126 58 122 92 C117 80 111 72 105 67
                 C103 77 97 81 90 83 C90 75 86 69 80 64 C76 73 70 79 62 81
                 C62 74 60 70 57 67 C49 73 43 82 38 92 Z" fill="${hair}"/>
        <circle cx="42" cy="75" r="5" fill="#f2a7c7"/>
        <circle cx="118" cy="75" r="5" fill="#f2a7c7"/>
        <path d="M104 50 l8 -6 2 9 z M104 50 l-1 -10 8 4 z" fill="#f2a7c7"/>
        ${brows}
        ${eyes}
        <ellipse cx="56" cy="112" rx="6" ry="3" fill="#ff9fb5" opacity="0.65"/>
        <ellipse cx="104" cy="112" rx="6" ry="3" fill="#ff9fb5" opacity="0.65"/>
        ${mouth}
      </g>
    </g>
    ${extras}
  </svg>`;
}

function showPopup(message, type = "error", onClose) {
  const popup = document.getElementById("popup");
  const box = document.getElementById("popupBox");
  const text = document.getElementById("popupText");
  const closeBtn = document.getElementById("popupClose");
  const isSuccess = type === "success";

  // Add the character + title once
  if (!box.querySelector(".pp-art")) {
    box.classList.add("popup-anime");
    box.insertAdjacentHTML("afterbegin", `<div class="pp-art"></div><h2 class="pp-title"></h2>`);
  }
  box.querySelector(".pp-art").innerHTML = popupGirl(type);
  box.querySelector(".pp-title").textContent = isSuccess ? "Yay, all done!" : "Oops! Small error";
  text.textContent = message;
  closeBtn.textContent = isSuccess ? "OK" : "OK, I'll fix it";
  closeBtn.classList.remove("pp-danger");
  const cancelBtn = document.getElementById("popupCancel");
  if (cancelBtn) cancelBtn.hidden = true;

  box.classList.toggle("success", isSuccess);
  box.classList.toggle("pp-success", isSuccess);
  box.classList.toggle("pp-error", !isSuccess);

  // Restart the entrance animation every time
  box.classList.remove("pp-in");
  void box.offsetWidth;
  box.classList.add("pp-in");
  popup.classList.add("show");
  closeBtn.focus();

  const close = () => {
    popup.classList.remove("show");
    document.removeEventListener("keydown", onKey);
    popup.onclick = null;
    if (onClose) onClose();
  };
  const onKey = (e) => { if (e.key === "Escape") close(); };

  closeBtn.onclick = close;
  popup.onclick = (e) => { if (e.target === popup) close(); };
  document.removeEventListener("keydown", popup._ppKey || (() => {}));
  popup._ppKey = onKey;
  setTimeout(() => document.addEventListener("keydown", onKey), 0);
}

// ---------- Yes / No confirmation (used for delete) ----------
function showConfirm(message, opts, onYes) {
  const { title = "Are you sure?", yesLabel = "Yes", noLabel = "Cancel" } = opts || {};
  const closeBtn = document.getElementById("popupClose");

  // Add a second button next to OK, once
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

  let confirmed = false;
  showPopup(message, "error", () => { if (confirmed && onYes) onYes(); });

  document.querySelector("#popupBox .pp-title").textContent = title;
  closeBtn.textContent = yesLabel;
  closeBtn.classList.add("pp-danger");
  cancelBtn.textContent = noLabel;
  cancelBtn.hidden = false;
  cancelBtn.focus();

  const baseClose = closeBtn.onclick;
  closeBtn.onclick = () => { confirmed = true; baseClose(); };
  cancelBtn.onclick = () => { confirmed = false; baseClose(); };
}
