'use strict';

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────
const STORAGE_KEY   = 'wheel-of-names-v1';
const MAX_NAMES     = 40;
const CANVAS_SIZE   = 400;
const SPIN_DURATION = 4000; // ms
const MIN_SPINS     = 5;
const MAX_SPINS     = 9;

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#82E0AA', '#F0B27A',
];

// ─────────────────────────────────────────────
//  State
//
//  allNames    – master list; names added by the user live here permanently
//                (only explicit X-button removals or Clear All touch this)
//  activeNames – the names currently on the wheel; may be a subset of allNames
//                when "remove after spin" has been removing winners
//  removeAfterSpin – reflects the toggle in the UI
// ─────────────────────────────────────────────
let allNames        = [];
let activeNames     = [];
let removeAfterSpin = false;
let currentRotation = 0;
let isSpinning      = false;
let pendingWinner   = null; // { index, name } while modal is open

// ─────────────────────────────────────────────
//  DOM References
// ─────────────────────────────────────────────
const canvas          = document.getElementById('wheel-canvas');
const ctx             = canvas.getContext('2d');
const nameInput       = document.getElementById('name-input');
const btnAdd          = document.getElementById('btn-add');
const btnSpin         = document.getElementById('btn-spin');
const toggleRemove    = document.getElementById('toggle-remove');
const namesList       = document.getElementById('names-list');
const namesCount      = document.getElementById('names-count');
const emptyState      = document.getElementById('empty-state');
const spinHint        = document.getElementById('spin-hint');
// Banner
const winnerBanner    = document.getElementById('winner-banner');
const winnerNameEl    = document.getElementById('winner-name');
const btnContinue     = document.getElementById('btn-continue');
// Names header action areas
const actionsNormal   = document.getElementById('actions-normal');
const actionsConfirm  = document.getElementById('actions-confirm');
const btnRestore      = document.getElementById('btn-restore');
const btnClear        = document.getElementById('btn-clear');
const btnConfirmYes   = document.getElementById('btn-confirm-yes');
const btnConfirmNo    = document.getElementById('btn-confirm-no');

// ─────────────────────────────────────────────
//  Canvas – HiDPI / Retina setup
// ─────────────────────────────────────────────
const DPR = window.devicePixelRatio || 1;
canvas.width        = CANVAS_SIZE * DPR;
canvas.height       = CANVAS_SIZE * DPR;
canvas.style.width  = CANVAS_SIZE + 'px';
canvas.style.height = CANVAS_SIZE + 'px';
ctx.scale(DPR, DPR);

// ─────────────────────────────────────────────
//  Persistence
// ─────────────────────────────────────────────
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    allNames        = Array.isArray(saved.allNames)    ? saved.allNames    : [];
    activeNames     = Array.isArray(saved.activeNames) ? saved.activeNames : [...allNames];
    removeAfterSpin = saved.removeAfterSpin === true;
  } catch (_) {
    allNames = activeNames = [];
    removeAfterSpin = false;
  }
  // Sync toggle to loaded state
  toggleRemove.checked = removeAfterSpin;
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    allNames,
    activeNames,
    removeAfterSpin,
  }));
}

// ─────────────────────────────────────────────
//  Name Management
// ─────────────────────────────────────────────

/** Add a new name to both the master list and the active wheel */
function addName(raw) {
  const name = raw.trim();
  if (!name) return;
  if (allNames.length >= MAX_NAMES) {
    flashInput('Max 40 names reached');
    return;
  }
  allNames.push(name);
  activeNames.push(name);
  save();
  refreshUI();
  drawWheel();
}

/**
 * Permanently remove a name (via the × button).
 * Removes from both the master list and the active list.
 */
function permanentRemove(activeIndex) {
  const name = activeNames[activeIndex];
  activeNames.splice(activeIndex, 1);
  // Also remove from master list (first occurrence)
  const masterIndex = allNames.indexOf(name);
  if (masterIndex !== -1) allNames.splice(masterIndex, 1);
  save();
  refreshUI();
  drawWheel();
}

/**
 * Remove a name from the active wheel only (after a spin).
 * The name stays in allNames so "Restore All" can bring it back.
 */
function removeFromActive(activeIndex) {
  activeNames.splice(activeIndex, 1);
  save();
  refreshUI();
  drawWheel();
}

/** Restore every name in the master list back onto the wheel */
function restoreAll() {
  activeNames = [...allNames];
  save();
  refreshUI();
  drawWheel();
}

/** Wipe everything */
function clearAll() {
  allNames    = [];
  activeNames = [];
  save();
  refreshUI();
  drawWheel();
}

// ─────────────────────────────────────────────
//  UI Refresh
// ─────────────────────────────────────────────
function refreshUI() {
  const total  = allNames.length;
  const active = activeNames.length;

  // Count label — show "5 / 8 names" when some have been spun away, else "5 names"
  if (active < total) {
    namesCount.textContent = `${active} / ${total} names`;
  } else {
    namesCount.textContent = `${active} ${active === 1 ? 'name' : 'names'}`;
  }

  // Restore All button — visible only when there are removed names to restore
  const hasRemoved = active < total;
  btnRestore.classList.toggle('hidden', !hasRemoved);
  if (hasRemoved) {
    btnRestore.textContent = `Restore All (${total})`;
  }

  // Render the active name list
  namesList.innerHTML = '';
  activeNames.forEach((name, i) => {
    const li  = document.createElement('li');
    li.className = 'name-item';

    const dot = document.createElement('span');
    dot.className        = 'name-dot';
    dot.style.background = COLORS[i % COLORS.length];

    const txt = document.createElement('span');
    txt.className   = 'name-text';
    txt.textContent = name;
    txt.title       = name;

    const rm = document.createElement('button');
    rm.className  = 'btn-remove';
    rm.innerHTML  = '&#215;';
    rm.title      = `Remove ${name}`;
    rm.addEventListener('click', () => permanentRemove(i));

    li.append(dot, txt, rm);
    namesList.appendChild(li);
  });

  // Empty state
  emptyState.classList.toggle('hidden', active > 0);

  // Spin button
  btnSpin.disabled = active < 2 || isSpinning;

  // Spin hint
  if (active === 0)      spinHint.textContent = 'Add at least 2 names to spin';
  else if (active === 1) spinHint.textContent = 'Add one more name to spin';
  else                   spinHint.textContent = '';
}

// ─────────────────────────────────────────────
//  Wheel Drawing
// ─────────────────────────────────────────────
const CX     = CANVAS_SIZE / 2;
const CY     = CANVAS_SIZE / 2;
const RADIUS = CANVAS_SIZE / 2 - 28;

function drawWheel() {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  if (activeNames.length === 0) {
    drawEmptyWheel();
    drawPointer();
    return;
  }

  const n          = activeNames.length;
  const sliceAngle = (2 * Math.PI) / n;

  for (let i = 0; i < n; i++) {
    const start = currentRotation + i * sliceAngle;
    const end   = start + sliceAngle;
    const color = COLORS[i % COLORS.length];

    // Slice
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.arc(CX, CY, RADIUS, start, end);
    ctx.closePath();
    ctx.fillStyle   = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth   = 2;
    ctx.stroke();

    // Label
    const mid      = start + sliceAngle / 2;
    const textDist = RADIUS * 0.63;
    const fontSize = n > 12 ? 9 : n > 8 ? 11 : 13;
    const maxChars = n > 8  ? 10 : 14;
    const label    = activeNames[i].length > maxChars
      ? activeNames[i].slice(0, maxChars - 1) + '…'
      : activeNames[i];

    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(mid);
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = isLightColor(color) ? '#333' : '#fff';
    ctx.font         = `bold ${fontSize}px -apple-system, 'Segoe UI', sans-serif`;
    ctx.shadowColor  = 'rgba(0,0,0,0.22)';
    ctx.shadowBlur   = 3;
    ctx.fillText(label, textDist, 0);
    ctx.restore();
  }

  // Outer ring
  ctx.beginPath();
  ctx.arc(CX, CY, RADIUS, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth   = 5;
  ctx.stroke();

  // Centre pin
  ctx.beginPath();
  ctx.arc(CX, CY, 14, 0, 2 * Math.PI);
  ctx.fillStyle   = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur  = 4;
  ctx.fill();
  ctx.shadowBlur  = 0;
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth   = 2;
  ctx.stroke();

  drawPointer();
}

function drawEmptyWheel() {
  ctx.beginPath();
  ctx.arc(CX, CY, RADIUS, 0, 2 * Math.PI);
  ctx.fillStyle   = '#ececec';
  ctx.fill();
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth   = 4;
  ctx.stroke();

  ctx.fillStyle    = '#b0b0b8';
  ctx.font         = '14px -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Add names to get started', CX, CY);
}

function drawPointer() {
  const tipY = CY - RADIUS + 4;
  const baseY = CY - RADIUS - 20;
  const hw = 11;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(CX - hw, baseY);
  ctx.lineTo(CX + hw, baseY);
  ctx.lineTo(CX,      tipY);
  ctx.closePath();
  ctx.fillStyle   = '#e74c3c';
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur  = 6;
  ctx.fill();
  ctx.shadowBlur  = 0;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 2;
  ctx.stroke();
  ctx.restore();
}

function isLightColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

// ─────────────────────────────────────────────
//  Spin Logic
// ─────────────────────────────────────────────
function spin() {
  if (isSpinning || activeNames.length < 2) return;

  isSpinning        = true;
  btnSpin.disabled  = true;
  btnSpin.textContent = 'Spinning…';

  const n          = activeNames.length;
  const sliceAngle = (2 * Math.PI) / n;
  const winnerIndex = Math.floor(Math.random() * n);

  // Calculate final rotation so the winner's slice centre lands at the pointer (12 o'clock = -π/2)
  //   finalRot + (winnerIndex + 0.5) * sliceAngle  ≡  -π/2  (mod 2π)
  const base     = -Math.PI / 2 - (winnerIndex + 0.5) * sliceAngle;
  const k        = Math.ceil((currentRotation - base) / (2 * Math.PI));
  const minFinal = base + k * 2 * Math.PI;
  const extra    = (MIN_SPINS + Math.floor(Math.random() * (MAX_SPINS - MIN_SPINS + 1))) * 2 * Math.PI;
  const finalRot = minFinal + extra;

  const startRot  = currentRotation;
  const startTime = performance.now();

  function frame(ts) {
    const elapsed  = ts - startTime;
    const progress = Math.min(elapsed / SPIN_DURATION, 1);
    const eased    = 1 - Math.pow(1 - progress, 4); // ease-out quartic

    currentRotation = startRot + (finalRot - startRot) * eased;
    drawWheel();

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      currentRotation = finalRot;
      isSpinning      = false;
      drawWheel();
      showWinner(winnerIndex);
    }
  }

  requestAnimationFrame(frame);
}

// ─────────────────────────────────────────────
//  Winner Banner
// ─────────────────────────────────────────────
function showWinner(index) {
  pendingWinner            = { index, name: activeNames[index] };
  winnerNameEl.textContent = pendingWinner.name;
  winnerBanner.classList.remove('hidden');
}

function closeBanner() {
  if (!pendingWinner) return;

  if (removeAfterSpin) {
    removeFromActive(pendingWinner.index);
  }

  pendingWinner = null;
  winnerBanner.classList.add('hidden');
  btnSpin.textContent = 'Spin';
  refreshUI();
}

// ─────────────────────────────────────────────
//  Clear All – two-state inline confirmation
// ─────────────────────────────────────────────
let clearConfirmTimer = null;

function showClearConfirm() {
  actionsNormal.classList.add('hidden');
  actionsConfirm.classList.remove('hidden');
  // Auto-cancel after 3 seconds
  clearConfirmTimer = setTimeout(hideClearConfirm, 3000);
}

function hideClearConfirm() {
  clearTimeout(clearConfirmTimer);
  clearConfirmTimer = null;
  actionsConfirm.classList.add('hidden');
  actionsNormal.classList.remove('hidden');
}

// ─────────────────────────────────────────────
//  Event Listeners
// ─────────────────────────────────────────────

// Add name
btnAdd.addEventListener('click', () => {
  addName(nameInput.value);
  nameInput.value = '';
  nameInput.focus();
});

nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    addName(nameInput.value);
    nameInput.value = '';
  }
});

// Toggle – remove after spin
toggleRemove.addEventListener('change', () => {
  removeAfterSpin = toggleRemove.checked;
  save();
});

// Restore all names
btnRestore.addEventListener('click', restoreAll);

// Clear All – first click shows inline confirm
btnClear.addEventListener('click', showClearConfirm);

// Inline confirm: Yes
btnConfirmYes.addEventListener('click', () => {
  hideClearConfirm();
  clearAll();
});

// Inline confirm: No
btnConfirmNo.addEventListener('click', hideClearConfirm);

// Spin
btnSpin.addEventListener('click', spin);

// Banner – Continue
btnContinue.addEventListener('click', closeBanner);

// Banner – Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !winnerBanner.classList.contains('hidden')) {
    closeBanner();
  }
});

// ─────────────────────────────────────────────
//  Init
// ─────────────────────────────────────────────
load();
refreshUI();
drawWheel();
nameInput.focus();

// Utility
function flashInput(message) {
  const prev = nameInput.placeholder;
  nameInput.placeholder  = message;
  nameInput.style.borderColor = '#ef4444';
  setTimeout(() => {
    nameInput.placeholder       = prev;
    nameInput.style.borderColor = '';
  }, 1800);
}
