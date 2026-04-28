// ============================================
// LEADERBOARD — obje kategorije
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { getAuth, signInAnonymously }
  from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";
import { getDatabase, ref, query, orderByChild, limitToLast, onValue }
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

const $fizikaContent = document.getElementById("lb-fizika");
const $opceContent   = document.getElementById("lb-opce");

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = String(totalSec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function rankDisplay(pos) {
  if (pos === 1) return "🥇";
  if (pos === 2) return "🥈";
  if (pos === 3) return "🥉";
  return `${pos}.`;
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

function renderTable($el, results) {
  if (results.length === 0) {
    $el.innerHTML = `<div class="lb-empty">Još nema rezultata ⚛️</div>`;
    return;
  }

  const sorted = sortResults(results).slice(0, 10);
  let html = `
    <div class="lb-row header">
      <span>#</span><span>Ime</span>
      <span style="text-align:right">Bodovi</span>
      <span style="text-align:right">Vrijeme</span>
    </div>
  `;

  sorted.forEach((entry, i) => {
    html += `
      <div class="lb-row new-entry">
        <span class="lb-rank">${rankDisplay(i + 1)}</span>
        <span class="lb-name">${escapeHtml(entry.name)}</span>
        <span class="lb-score">${entry.score}/10</span>
        <span class="lb-time">${formatTime(entry.timeMs || 0)}</span>
      </div>
    `;
  });

  $el.innerHTML = html;
}

function listenCategory(dbPath, $el) {
  const resultsRef = ref(db, dbPath);
  const topQuery = query(resultsRef, orderByChild("score"), limitToLast(50));

  onValue(topQuery, (snapshot) => {
    const results = [];
    snapshot.forEach((child) => {
      results.push({ id: child.key, ...child.val() });
    });
    renderTable($el, results);
  }, (error) => {
    console.error("Greška:", error);
    $el.innerHTML = `<div class="lb-empty">Greška pri učitavanju.</div>`;
  });
}

async function init() {
  try {
    await signInAnonymously(auth);
  } catch (err) {
    console.error("Auth greška:", err);
    return;
  }

  listenCategory("results/fizika", $fizikaContent);
  listenCategory("results/opce", $opceContent);
}

init();
