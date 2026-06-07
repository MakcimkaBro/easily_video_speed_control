// ─── Обработчик сообщений от popup.js ───────────────────────────────────────
// setSpeed — применяет скорость ко всем видео на странице
// getSpeed  — возвращает текущую скорость первого найденного видео
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "setSpeed") {
    const videos = document.querySelectorAll("video");
    if (videos.length === 0) {
      sendResponse({ success: false, error: "No video found" });
      return;
    }
    videos.forEach(v => v.playbackRate = message.speed);
    sendResponse({ success: true, count: videos.length });
  }
  if (message.action === "getSpeed") {
    const video = document.querySelector("video");
    sendResponse({ speed: video ? video.playbackRate : 1.0 });
  }
});

// ─── Константы и состояние оверлея ──────────────────────────────────────────
const PRESETS = [0.5, 1, 1.5, 2, 3, 4, 6, 8, 10, 12, 16];
let overlayBtn   = null;   // плавающая кнопка
let overlayPopup = null;   // попап с контролами
let isDragging   = false;  // флаг перетаскивания кнопки
let dragOffsetX  = 0;
let dragOffsetY  = 0;

// ─── Утилиты ─────────────────────────────────────────────────────────────────
// Возвращает текущую скорость воспроизведения первого видео на странице
function getCurrentSpeed() {
  const v = document.querySelector("video");
  return v ? v.playbackRate : 1.0;
}

// Зажимает скорость в [0.1, 16], применяет ко всем видео и синхронизирует UI
function setSpeed(speed) {
  speed = Math.min(16, Math.max(0.1, parseFloat(speed)));
  if (isNaN(speed)) return;
  document.querySelectorAll("video").forEach(v => v.playbackRate = speed);
  updateOverlaySpeed(speed);
  if (overlayPopup) syncPopupUI(speed);
}

// Форматтер для badge и лейбла кнопки: "1x", "1.5x" и т.д.
function fmtBadge(v) {
  const s = parseFloat(v);
  return (Number.isInteger(s) ? s : s) + "x";
}

// Форматтер с одним знаком после запятой
function fmt(v) {
  return parseFloat(v).toFixed(1);
}

// ─── Обновление лейбла скорости на плавающей кнопке ─────────────────────────
function updateOverlaySpeed(speed) {
  if (!overlayBtn) return;
  const label = overlayBtn.querySelector(".ovl-speed-label");
  if (label) label.textContent = fmtBadge(speed);
}

// Синхронизирует слайдер, числовой инпут, большой дисплей и preset-кнопки в попапе
function syncPopupUI(speed) {
  if (!overlayPopup) return;
  const slider   = overlayPopup.querySelector(".ovl-slider");
  const numInput = overlayPopup.querySelector(".ovl-num");
  const bigDisp  = overlayPopup.querySelector(".ovl-big");
  if (slider)   slider.value   = speed;
  if (numInput) numInput.value = fmt(speed);
  if (bigDisp) {
    bigDisp.textContent = fmt(speed);
    let span = bigDisp.querySelector("span");
    if (!span) {
      span = document.createElement("span");
      Object.assign(span.style, { fontSize: "16px", color: "#a78bfa" });
      bigDisp.appendChild(span);
    }
    span.textContent = "x";
  }
  overlayPopup.querySelectorAll(".ovl-preset-btn").forEach(btn => {
    btn.classList.toggle("active", parseFloat(btn.dataset.speed) === speed);
  });
}

// ─── Создание плавающей кнопки оверлея ──────────────────────────────────────
// Кнопка перетаскивается мышью; клик открывает/закрывает попап
function createOverlayBtn() {
  const btn = document.createElement("div");
  btn.id = "__vsc_overlay_btn__";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("viewBox", "0 -960 960 960");
  svg.setAttribute("fill", "#1a1a2e");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M102.67-240v-480l350.66 240zm404.66 0v-480L858-480z");
  svg.appendChild(path);

  const label = document.createElement("span");
  label.className = "ovl-speed-label";
  Object.assign(label.style, {
    fontSize: "10px", fontWeight: "bold",
    color: "#a78bfa", lineHeight: "1", marginTop: "1px"
  });
  label.textContent = fmtBadge(getCurrentSpeed());

  btn.appendChild(svg);
  btn.appendChild(label);

  Object.assign(btn.style, {
    position:       "fixed",
    top:            "20px",
    right:          "20px",
    width:          "40px",
    height:         "40px",
    borderRadius:   "50%",
    background:     "rgba(255,255,255,0.95)",
    boxShadow:      "0 2px 12px rgba(0,0,0,0.4)",
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    cursor:         "grab",
    zIndex:         "2147483647",
    userSelect:     "none",
    transition:     "box-shadow 0.15s",
  });

  // Начало перетаскивания
  btn.addEventListener("mousedown", e => {
    if (e.button !== 0) return;
    isDragging  = true;
    dragOffsetX = e.clientX - btn.getBoundingClientRect().left;
    dragOffsetY = e.clientY - btn.getBoundingClientRect().top;
    btn.style.cursor = "grabbing";
    btn.style.transition = "none";
    e.preventDefault();
    e.stopPropagation();
  });

  // Клик по кнопке — переключить попап
  btn.addEventListener("click", e => {
    e.stopPropagation();
    if (overlayPopup) togglePopup();
  });

  return btn;
}

// ─── Создание попапа с контролами скорости ───────────────────────────────────
// Содержит большой дисплей, слайдер, числовой инпут и preset-кнопки.
// Весь DOM строится вручную — без innerHTML — чтобы пройти валидацию Firefox.
function createOverlayPopup() {
  const popup = document.createElement("div");
  popup.id = "__vsc_overlay_popup__";
  const speed = getCurrentSpeed();

  Object.assign(popup.style, {
    position:     "fixed",
    top:          "68px",
    right:        "20px",
    width:        "260px",
    background:   "#1a1a2e",
    borderRadius: "12px",
    padding:      "16px",
    boxShadow:    "0 4px 24px rgba(0,0,0,0.6)",
    zIndex:       "2147483646",
    fontFamily:   "Segoe UI, sans-serif",
    color:        "#eee",
  });

  // Заголовок "⚡ Video Speed"
  const title = document.createElement("div");
  Object.assign(title.style, {
    fontSize:      "13px",
    color:         "#a78bfa",
    textAlign:     "center",
    letterSpacing: "1px",
    marginBottom:  "12px",
    textTransform: "uppercase",
  });
  title.textContent = "⚡ Video Speed";
  popup.appendChild(title);

  // Большой дисплей скорости
  const bigDisp = document.createElement("div");
  bigDisp.className = "ovl-big";
  Object.assign(bigDisp.style, {
    textAlign:    "center",
    fontSize:     "36px",
    fontWeight:   "bold",
    color:        "#fff",
    marginBottom: "8px",
    lineHeight:   "1",
  });
  bigDisp.textContent = fmt(speed);
  const bigSpan = document.createElement("span");
  Object.assign(bigSpan.style, { fontSize: "16px", color: "#a78bfa" });
  bigSpan.textContent = "x";
  bigDisp.appendChild(bigSpan);
  popup.appendChild(bigDisp);

  // Слайдер
  const slider = document.createElement("input");
  slider.className = "ovl-slider";
  slider.type  = "range";
  slider.min   = "0.1";
  slider.max   = "16";
  slider.step  = "0.1";
  slider.value = String(speed);
  Object.assign(slider.style, {
    width:        "100%",
    accentColor:  "#a78bfa",
    cursor:       "pointer",
    marginBottom: "4px",
  });
  popup.appendChild(slider);

  // Подписи под слайдером
  const sliderLabels = document.createElement("div");
  Object.assign(sliderLabels.style, {
    display:       "flex",
    justifyContent:"space-between",
    fontSize:      "10px",
    color:         "#666",
    marginBottom:  "12px",
  });
  ["0.1x", "4x", "8x", "16x"].forEach(t => {
    const s = document.createElement("span");
    s.textContent = t;
    sliderLabels.appendChild(s);
  });
  popup.appendChild(sliderLabels);

  // Строка "Скорость: [input]"
  const numRow = document.createElement("div");
  Object.assign(numRow.style, {
    display:      "flex",
    alignItems:   "center",
    gap:          "8px",
    marginBottom: "12px",
  });
  const numLabel = document.createElement("span");
  Object.assign(numLabel.style, { fontSize: "12px", color: "#aaa" });
  numLabel.textContent = "Скорость:";
  const numInput = document.createElement("input");
  numInput.className = "ovl-num";
  numInput.type  = "number";
  numInput.min   = "0.1";
  numInput.max   = "16";
  numInput.step  = "0.1";
  numInput.value = fmt(speed);
  Object.assign(numInput.style, {
    flex:         "1",
    background:   "#16213e",
    border:       "1px solid #a78bfa55",
    borderRadius: "6px",
    color:        "#fff",
    fontSize:     "13px",
    padding:      "5px 8px",
    outline:      "none",
  });
  numRow.appendChild(numLabel);
  numRow.appendChild(numInput);
  popup.appendChild(numRow);

  // Preset-кнопки
  const presetsRow = document.createElement("div");
  Object.assign(presetsRow.style, {
    display:        "flex",
    gap:            "5px",
    flexWrap:       "wrap",
    justifyContent: "center",
  });
  PRESETS.forEach(s => {
    const btn = document.createElement("button");
    btn.className = "ovl-preset-btn" + (s === speed ? " active" : "");
    btn.dataset.speed = String(s);
    btn.textContent = s + "x";
    btn.addEventListener("click", e => {
      e.stopPropagation();
      setSpeed(btn.dataset.speed);
    });
    presetsRow.appendChild(btn);
  });
  popup.appendChild(presetsRow);

  injectStyles();

  // Слушатели ввода
  slider.addEventListener("input",  () => setSpeed(slider.value));
  numInput.addEventListener("change", () => setSpeed(numInput.value));
  numInput.addEventListener("keydown", e => {
    if (e.key === "Enter") setSpeed(numInput.value);
  });

  // Блокируем всплытие кликов/mousedown наружу, чтобы попап не закрывался сам
  popup.addEventListener("click",     e => e.stopPropagation());
  popup.addEventListener("mousedown", e => e.stopPropagation());

  return popup;
}

// ─── Инжект CSS для preset-кнопок (один раз на страницу) ────────────────────
function injectStyles() {
  if (document.getElementById("__vsc_styles__")) return;
  const style = document.createElement("style");
  style.id = "__vsc_styles__";
  style.textContent = `
    .ovl-preset-btn {
      background: #16213e;
      border: 1px solid #a78bfa44;
      color: #ccc;
      border-radius: 6px;
      padding: 4px 7px;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.15s;
      min-width: 32px;
    }
    .ovl-preset-btn:hover,
    .ovl-preset-btn.active {
      background: #a78bfa;
      color: #fff;
      border-color: #a78bfa;
    }
  `;
  document.head.appendChild(style);
}

// ─── Показ / скрытие попапа ──────────────────────────────────────────────────
function togglePopup() {
  if (!overlayPopup) return;
  const visible = overlayPopup.style.display !== "none";
  overlayPopup.style.display = visible ? "none" : "block";
  if (!visible) syncPopupUI(getCurrentSpeed());
}

// Пересчитывает позицию попапа относительно текущего положения кнопки
function repositionPopup() {
  if (!overlayBtn || !overlayPopup) return;
  const rect = overlayBtn.getBoundingClientRect();
  overlayPopup.style.top  = (rect.bottom + 8) + "px";
  overlayPopup.style.left = Math.max(8, rect.left - 220 + rect.width) + "px";
  overlayPopup.style.right = "auto";
}

// ─── Монтирование и размонтирование оверлея ─────────────────────────────────
function showOverlay() {
  if (overlayBtn) return;
  overlayBtn   = createOverlayBtn();
  overlayPopup = createOverlayPopup();
  overlayPopup.style.display = "none";
  document.body.appendChild(overlayBtn);
  document.body.appendChild(overlayPopup);
  repositionPopup();
}

function hideOverlay() {
  if (overlayBtn)   { overlayBtn.remove();   overlayBtn   = null; }
  if (overlayPopup) { overlayPopup.remove();  overlayPopup = null; }
}

// ─── Глобальные слушатели мыши ───────────────────────────────────────────────
// Перемещение кнопки во время drag
document.addEventListener("mousemove", e => {
  if (!isDragging || !overlayBtn) return;
  let x = e.clientX - dragOffsetX;
  let y = e.clientY - dragOffsetY;
  x = Math.max(0, Math.min(window.innerWidth  - 40, x));
  y = Math.max(0, Math.min(window.innerHeight - 40, y));
  overlayBtn.style.left  = x + "px";
  overlayBtn.style.top   = y + "px";
  overlayBtn.style.right = "auto";
  repositionPopup();
});

// Завершение drag
document.addEventListener("mouseup", () => {
  if (isDragging) {
    isDragging = false;
    if (overlayBtn) overlayBtn.style.cursor = "grab";
  }
});

// Клик вне попапа — закрыть его
document.addEventListener("click", () => {
  if (overlayPopup && overlayPopup.style.display !== "none") {
    overlayPopup.style.display = "none";
  }
});

// ─── Реакция на полноэкранный режим ─────────────────────────────────────────
// Показываем оверлей при входе в fullscreen, скрываем при выходе
document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement) {
    showOverlay();
  } else {
    hideOverlay();
  }
});

// Webkit-версия для Safari / старых браузеров
document.addEventListener("webkitfullscreenchange", () => {
  if (document.webkitFullscreenElement) {
    showOverlay();
  } else {
    hideOverlay();
  }
});