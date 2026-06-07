// ─── DOM-элементы ───────────────────────────────────────────────────────────
const slider     = document.getElementById("slider");
const numInput   = document.getElementById("numInput");
const bigDisplay = document.getElementById("bigDisplay");
const status     = document.getElementById("status");
const presetBtns = document.querySelectorAll(".presets button");
let currentSpeed = 1.0;

// ─── Кнопки ±0.1 ────────────────────────────────────────────────────────────
document.getElementById("btnMinus").addEventListener("click", () => {
  const val = Math.round((parseFloat(numInput.value) - 0.1) * 10) / 10;
  applySpeed(val);
});
document.getElementById("btnPlus").addEventListener("click", () => {
  const val = Math.round((parseFloat(numInput.value) + 0.1) * 10) / 10;
  applySpeed(val);
});

// ─── Вспомогательные форматтеры ─────────────────────────────────────────────
// Возвращает число с одним знаком после запятой
function fmt(v) {
  return parseFloat(v).toFixed(1);
}
// Возвращает строку для badge: "1x", "1.5x" и т.д.
function fmtBadge(v) {
  const s = parseFloat(v);
  return (Number.isInteger(s) ? s : s) + "x";
}

// ─── Обновление UI без отправки в контент-скрипт ────────────────────────────
function updateUI(speed) {
  currentSpeed = speed;
  slider.value    = speed;
  numInput.value  = fmt(speed);
  bigDisplay.textContent = fmt(speed);
  let span = bigDisplay.querySelector("span");
  if (!span) {
    span = document.createElement("span");
    bigDisplay.appendChild(span);
  }
  span.textContent = "x";
  highlightPreset(speed);
}

// Подсвечивает активную preset-кнопку
function highlightPreset(speed) {
  presetBtns.forEach(btn => {
    btn.classList.toggle("active", parseFloat(btn.dataset.speed) === speed);
  });
}

// Устанавливает текст и стиль строки статуса
function setStatus(msg, type = "") {
  status.textContent = msg;
  status.className = "status " + type;
}

// ─── Основная функция применения скорости ───────────────────────────────────
// Зажимает значение в [0.1, 16], обновляет UI, badge и отправляет
// сообщение setSpeed в контент-скрипт активной вкладки
async function applySpeed(speed) {
  speed = Math.min(16, Math.max(0.1, parseFloat(speed)));
  if (isNaN(speed)) return;

  updateUI(speed);
  chrome.action.setBadgeText({ text: fmtBadge(speed) });
  chrome.action.setBadgeBackgroundColor({ color: "#a78bfa" });

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = await chrome.tabs.sendMessage(tab.id, { action: "setSpeed", speed });
    if (res?.success) {
      setStatus(`✓ Применено к ${res.count} видео`, "ok");
    } else {
      setStatus("Видео не найдено на странице", "err");
    }
  } catch {
    setStatus("Нет доступа к странице", "err");
  }
}

// ─── Слушатели пользовательского ввода ──────────────────────────────────────
slider.addEventListener("input", () => applySpeed(slider.value));
numInput.addEventListener("change", () => applySpeed(numInput.value));
numInput.addEventListener("keydown", e => {
  if (e.key === "Enter") applySpeed(numInput.value);
});
presetBtns.forEach(btn => {
  btn.addEventListener("click", () => applySpeed(btn.dataset.speed));
});

// ─── Инициализация: синхронизация с текущей скоростью вкладки ───────────────
// При открытии попапа запрашивает getSpeed из контент-скрипта и
// восстанавливает UI + badge в соответствии с реальным состоянием
(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = await chrome.tabs.sendMessage(tab.id, { action: "getSpeed" });
    if (res?.speed) {
      updateUI(res.speed);
      chrome.action.setBadgeText({ text: fmtBadge(res.speed) });
      chrome.action.setBadgeBackgroundColor({ color: "#a78bfa" });
    }
  } catch {
  
  }
})();