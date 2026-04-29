// ============================================
// ADMIN — s kategorijama (fizika / opce)
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { getAuth, signInAnonymously }
  from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";
import { getDatabase, ref, query, orderByChild, onValue, remove, update }
  from "https://www.gstatic.com/firebasejs/11.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD7MxLO2H0BLSgu07mxh7cYg3d2XM91WeI",
  authDomain: "fizika-challenge-757f7.firebaseapp.com",
  databaseURL: "https://fizika-challenge-757f7-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "fizika-challenge-757f7",
  storageBucket: "fizika-challenge-757f7.firebasestorage.app",
  messagingSenderId: "462864759911",
  appId: "1:462864759911:web:5e47b89c750232f81368c2"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);

// ⚠️ PROMIJENI OVAJ PIN!
const ADMIN_PIN = "1234";

// --------------------------------------------------
// Stanje
// --------------------------------------------------
let fizikaResults = [];
let opceResults = [];
let activeCategory = "fizika"; // "fizika" ili "opce"
let editingKey = null;
let deleteTarget = null;

// --------------------------------------------------
// DOM
// --------------------------------------------------
const $screenLogin   = document.getElementById("screen-login");
const $screenAdmin   = document.getElementById("screen-admin");
const $pinInput      = document.getElementById("pin-input");
const $pinError      = document.getElementById("pin-error");
const $adminContent  = document.getElementById("admin-content");
const $resultCount   = document.getElementById("result-count");
const $btnDeleteAll  = document.getElementById("btn-delete-all");
const $tabFizika     = document.getElementById("tab-fizika");
const $tabOpce       = document.getElementById("tab-opce");

const $modalEdit     = document.getElementById("modal-edit");
const $editName      = document.getElementById("edit-name");
const $editScore     = document.getElementById("edit-score");
const $editTime      = document.getElementById("edit-time");
const $btnEditCancel = document.getElementById("btn-edit-cancel");
const $btnEditSave   = document.getElementById("btn-edit-save");

const $modalConfirm     = document.getElementById("modal-confirm");
const $confirmText      = document.getElementById("confirm-text");
const $btnConfirmCancel = document.getElementById("btn-confirm-cancel");
const $btnConfirmDelete = document.getElementById("btn-confirm-delete");

// --------------------------------------------------
// Pomoćne
// --------------------------------------------------
function showScreen(screen) {
  [$screenLogin, $screenAdmin].forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = String(totalSec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function sortResults(results) {
  return results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.timeMs || 0) - (b.timeMs || 0);
  });
}

function getActiveResults() {
  return activeCategory === "fizika" ? fizikaResults : opceResults;
}

function getDbPath() {
  return `results/${activeCategory}`;
}

// --------------------------------------------------
// PIN
// --------------------------------------------------
$pinInput.addEventListener("input", () => {
  $pinError.textContent = "";
  if ($pinInput.value.length === 4) {
    if ($pinInput.value === ADMIN_PIN) {
      showScreen($screenAdmin);
      initAdmin();
    } else {
      $pinError.textContent = "Krivi PIN!";
      $pinInput.value = "";
    }
  }
});
$pinInput.focus();

// --------------------------------------------------
// Tabovi
// --------------------------------------------------
$tabFizika.addEventListener("click", () => switchTab("fizika"));
$tabOpce.addEventListener("click", () => switchTab("opce"));

function switchTab(cat) {
  activeCategory = cat;
  $tabFizika.classList.toggle("active", cat === "fizika");
  $tabOpce.classList.toggle("active", cat === "opce");
  renderAdmin();
}

// --------------------------------------------------
// Renderiranje
// --------------------------------------------------
function renderAdmin() {
  const results = getActiveResults();
  const sorted = sortResults([...results]);
  const label = activeCategory === "fizika" ? "⚛️ Fizika" : "🧠 Opće znanje";
  $resultCount.textContent = `${label} — ${sorted.length} rezultat(a)`;

  if (sorted.length === 0) {
    $adminContent.innerHTML = `<div class="lb-empty">Nema rezultata u ovoj kategoriji.</div>`;
    return;
  }

  let html = `
    <div class="admin-row header">
      <span>Ime</span>
      <span style="text-align:center">Bod.</span>
      <span style="text-align:center">Vrijeme</span>
      <span style="text-align:right">Akcije</span>
    </div>
  `;

  sorted.forEach((entry) => {
    html += `
      <div class="admin-row" data-key="${entry.key}">
        <span class="admin-name">${escapeHtml(entry.name || '—')}</span>
        <span class="admin-score">${entry.score}/10</span>
        <span class="admin-time">${formatTime(entry.timeMs || 0)}</span>
        <div class="admin-actions">
          <button class="btn-icon edit" title="Uredi" onclick="window._edit('${entry.key}')">✏️</button>
          <button class="btn-icon" title="Obriši" onclick="window._delete('${entry.key}', '${escapeHtml(entry.name || '—')}')">✕</button>
        </div>
      </div>
    `;
  });

  $adminContent.innerHTML = html;
}

// --------------------------------------------------
// Firebase init
// --------------------------------------------------
async function initAdmin() {
  try {
    await signInAnonymously(auth);
    console.log("Admin: prijava uspješna");
  } catch (err) {
    console.error("Auth greška:", err);
    $adminContent.innerHTML = `<div class="lb-empty">Greška pri prijavi.</div>`;
    return;
  }

  // Listener za fiziku
  const fizikaRef = ref(db, "results/fizika");
  const fizikaQuery = query(fizikaRef, orderByChild("score"));
  onValue(fizikaQuery, (snapshot) => {
    fizikaResults = [];
    snapshot.forEach((child) => {
      fizikaResults.push({ key: child.key, ...child.val() });
    });
    if (activeCategory === "fizika") renderAdmin();
  }, (err) => console.error("Fizika greška:", err));

  // Listener za opće
  const opceRef = ref(db, "results/opce");
  const opceQuery = query(opceRef, orderByChild("score"));
  onValue(opceQuery, (snapshot) => {
    opceResults = [];
    snapshot.forEach((child) => {
      opceResults.push({ key: child.key, ...child.val() });
    });
    if (activeCategory === "opce") renderAdmin();
  }, (err) => console.error("Opće greška:", err));
}

// --------------------------------------------------
// Brisanje
// --------------------------------------------------
window._delete = function(key, name) {
  deleteTarget = { key, name };
  $confirmText.textContent = `Obrisati rezultat igrača "${name}"?`;
  $modalConfirm.classList.add("active");
};

$btnDeleteAll.addEventListener("click", () => {
  const results = getActiveResults();
  if (results.length === 0) return;
  const label = activeCategory === "fizika" ? "Fizika" : "Opće znanje";
  deleteTarget = "all";
  $confirmText.textContent = `Obrisati SVE rezultate iz kategorije ${label} (${results.length})?`;
  $modalConfirm.classList.add("active");
});

$btnConfirmDelete.addEventListener("click", async () => {
  if (!deleteTarget) return;
  try {
    if (deleteTarget === "all") {
      await remove(ref(db, getDbPath()));
    } else {
      await remove(ref(db, `${getDbPath()}/${deleteTarget.key}`));
    }
  } catch (err) {
    console.error("Greška:", err);
    alert("Greška: " + err.message);
  }
  deleteTarget = null;
  $modalConfirm.classList.remove("active");
});

$btnConfirmCancel.addEventListener("click", () => {
  deleteTarget = null;
  $modalConfirm.classList.remove("active");
});

$modalConfirm.addEventListener("click", (e) => {
  if (e.target === $modalConfirm) {
    deleteTarget = null;
    $modalConfirm.classList.remove("active");
  }
});

// --------------------------------------------------
// Uređivanje
// --------------------------------------------------
window._edit = function(key) {
  const results = getActiveResults();
  const entry = results.find(r => r.key === key);
  if (!entry) return;

  editingKey = key;
  $editName.value = entry.name || "";
  $editScore.value = entry.score ?? 0;
  $editTime.value = entry.timeMs ?? 0;
  $modalEdit.classList.add("active");
  $editName.focus();
};

$btnEditSave.addEventListener("click", async () => {
  if (!editingKey) return;

  const name = $editName.value.trim();
  const score = parseInt($editScore.value, 10);
  const timeMs = parseInt($editTime.value, 10);

  if (!name) { alert("Ime ne može biti prazno!"); return; }
  if (isNaN(score) || score < 0 || score > 10) { alert("Bodovi: 0–10!"); return; }
  if (isNaN(timeMs) || timeMs < 0) { alert("Vrijeme mora biti pozitivno!"); return; }

  try {
    await update(ref(db, `${getDbPath()}/${editingKey}`), {
      name, score,
      percentage: Math.round((score / 10) * 100),
      timeMs
    });
  } catch (err) {
    console.error("Greška:", err);
    alert("Greška: " + err.message);
  }

  editingKey = null;
  $modalEdit.classList.remove("active");
});

$btnEditCancel.addEventListener("click", () => {
  editingKey = null;
  $modalEdit.classList.remove("active");
});

$modalEdit.addEventListener("click", (e) => {
  if (e.target === $modalEdit) {
    editingKey = null;
    $modalEdit.classList.remove("active");
  }
});
