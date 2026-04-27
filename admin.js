// ============================================
// FIZIKA CHALLENGE — admin.js
// Admin panel: brisanje i uređivanje rezultata
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

// --------------------------------------------------
// ⚠️  PROMIJENI OVAJ PIN! (default: 1234)
// --------------------------------------------------
const ADMIN_PIN = "0000";

// --------------------------------------------------
// Stanje
// --------------------------------------------------
let allResults = [];        // Svi rezultati iz baze
let editingKey = null;      // Ključ zapisa koji se uređuje
let deleteTarget = null;    // { key, name } ili "all"

// --------------------------------------------------
// DOM elementi
// --------------------------------------------------
const $screenLogin   = document.getElementById("screen-login");
const $screenAdmin   = document.getElementById("screen-admin");
const $pinInput      = document.getElementById("pin-input");
const $pinError      = document.getElementById("pin-error");
const $adminContent  = document.getElementById("admin-content");
const $resultCount   = document.getElementById("result-count");
const $btnDeleteAll  = document.getElementById("btn-delete-all");

// Edit modal
const $modalEdit     = document.getElementById("modal-edit");
const $editName      = document.getElementById("edit-name");
const $editScore     = document.getElementById("edit-score");
const $editTime      = document.getElementById("edit-time");
const $btnEditCancel = document.getElementById("btn-edit-cancel");
const $btnEditSave   = document.getElementById("btn-edit-save");

// Confirm modal
const $modalConfirm     = document.getElementById("modal-confirm");
const $confirmText      = document.getElementById("confirm-text");
const $btnConfirmCancel = document.getElementById("btn-confirm-cancel");
const $btnConfirmDelete = document.getElementById("btn-confirm-delete");

// --------------------------------------------------
// Pomoćne funkcije
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

// --------------------------------------------------
// PIN prijava
// --------------------------------------------------
$pinInput.addEventListener("input", () => {
  $pinError.textContent = "";
  const pin = $pinInput.value;

  if (pin.length === 4) {
    if (pin === ADMIN_PIN) {
      showScreen($screenAdmin);
      initAdmin();
    } else {
      $pinError.textContent = "Krivi PIN!";
      $pinInput.value = "";
    }
  }
});

// Fokusiraj PIN input odmah
$pinInput.focus();

// --------------------------------------------------
// Admin inicijalizacija
// --------------------------------------------------
async function initAdmin() {
  // Anonimna prijava
  try {
    await signInAnonymously(auth);
    console.log("Admin: anonimna prijava uspješna");
  } catch (err) {
    console.error("Auth greška:", err);
    $adminContent.innerHTML = `<div class="lb-empty">Greška pri prijavi.</div>`;
    return;
  }

  // Real-time listener na sve rezultate
  const resultsRef = ref(db, "results");
  const allQuery = query(resultsRef, orderByChild("score"));

  onValue(allQuery, (snapshot) => {
    allResults = [];
    snapshot.forEach((child) => {
      allResults.push({ key: child.key, ...child.val() });
    });
    renderAdmin(allResults);
  }, (error) => {
    console.error("Greška čitanja:", error);
    $adminContent.innerHTML = `<div class="lb-empty">Greška: ${error.message}</div>`;
  });
}

// --------------------------------------------------
// Renderiranje admin tablice
// --------------------------------------------------
function renderAdmin(results) {
  const sorted = sortResults([...results]);
  $resultCount.textContent = `${sorted.length} rezultat(a) ukupno`;

  if (sorted.length === 0) {
    $adminContent.innerHTML = `
      <div class="lb-empty">Nema rezultata u bazi.</div>
    `;
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
// Brisanje jednog rezultata
// --------------------------------------------------
window._delete = function(key, name) {
  deleteTarget = { key, name };
  $confirmText.textContent = `Obrisati rezultat igrača "${name}"?`;
  $modalConfirm.classList.add("active");
};

$btnConfirmDelete.addEventListener("click", async () => {
  if (!deleteTarget) return;

  try {
    if (deleteTarget === "all") {
      // Obriši sve
      await remove(ref(db, "results"));
      console.log("Svi rezultati obrisani.");
    } else {
      // Obriši jedan
      await remove(ref(db, `results/${deleteTarget.key}`));
      console.log(`Obrisan: ${deleteTarget.key}`);
    }
  } catch (err) {
    console.error("Greška pri brisanju:", err);
    alert("Greška pri brisanju: " + err.message);
  }

  deleteTarget = null;
  $modalConfirm.classList.remove("active");
});

$btnConfirmCancel.addEventListener("click", () => {
  deleteTarget = null;
  $modalConfirm.classList.remove("active");
});

// Klik izvan modala zatvara ga
$modalConfirm.addEventListener("click", (e) => {
  if (e.target === $modalConfirm) {
    deleteTarget = null;
    $modalConfirm.classList.remove("active");
  }
});

// --------------------------------------------------
// Brisanje svih rezultata
// --------------------------------------------------
$btnDeleteAll.addEventListener("click", () => {
  if (allResults.length === 0) return;
  deleteTarget = "all";
  $confirmText.textContent = `Obrisati SVE rezultate (${allResults.length})?`;
  $modalConfirm.classList.add("active");
});

// --------------------------------------------------
// Uređivanje rezultata
// --------------------------------------------------
window._edit = function(key) {
  const entry = allResults.find(r => r.key === key);
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

  // Validacija
  if (!name) { alert("Ime ne može biti prazno!"); return; }
  if (isNaN(score) || score < 0 || score > 10) { alert("Bodovi moraju biti 0–10!"); return; }
  if (isNaN(timeMs) || timeMs < 0) { alert("Vrijeme mora biti pozitivan broj!"); return; }

  const pct = Math.round((score / 10) * 100);

  try {
    await update(ref(db, `results/${editingKey}`), {
      name: name,
      score: score,
      percentage: pct,
      timeMs: timeMs
    });
    console.log(`Ažurirano: ${editingKey}`);
  } catch (err) {
    console.error("Greška pri spremanju:", err);
    alert("Greška: " + err.message);
  }

  editingKey = null;
  $modalEdit.classList.remove("active");
});

$btnEditCancel.addEventListener("click", () => {
  editingKey = null;
  $modalEdit.classList.remove("active");
});

// Klik izvan modala zatvara ga
$modalEdit.addEventListener("click", (e) => {
  if (e.target === $modalEdit) {
    editingKey = null;
    $modalEdit.classList.remove("active");
  }
});
