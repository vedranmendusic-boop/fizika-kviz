// ============================================
// LEADERBOARD — 3 kategorije
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { getDatabase, ref, onValue }
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
const db   = getDatabase(app);

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
}

function rankDisplay(pos) {
  if (pos === 1) return "🥇";
  if (pos === 2) return "🥈";
  if (pos === 3) return "🥉";
  return `${pos}.`;
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function sortResults(r) {
  return r.sort((a, b) => b.score !== a.score ? b.score - a.score : (a.timeMs||0) - (b.timeMs||0));
}

function renderTable($el, results) {
  if (!results.length) {
    $el.innerHTML = `<div class="lb-empty">Još nema rezultata</div>`;
    return;
  }
  const sorted = sortResults(results).slice(0, 10);
  let html = `<div class="lb-row header"><span>#</span><span>Ime</span><span style="text-align:right">Bodovi</span><span style="text-align:right">Vrijeme</span></div>`;
  sorted.forEach((e, i) => {
    html += `<div class="lb-row new-entry"><span class="lb-rank">${rankDisplay(i+1)}</span><span class="lb-name">${escapeHtml(e.name)}</span><span class="lb-score">${e.score}/20</span><span class="lb-time">${formatTime(e.timeMs||0)}</span></div>`;
  });
  $el.innerHTML = html;
}

function listen(path, $el) {
  onValue(ref(db, path), (snap) => {
    const r = [];
    snap.forEach(c => r.push({ id: c.key, ...c.val() }));
    renderTable($el, r);
  }, (err) => {
    console.error("Leaderboard greška:", path, err);
    $el.innerHTML = `<div class="lb-empty">Greška: ${escapeHtml(err.message || "nema dozvole")}</div>`;
  });
}

function init() {
  listen("results/fizika7", document.getElementById("lb-fizika7"));
  listen("results/fizika8", document.getElementById("lb-fizika8"));
  listen("results/opce",    document.getElementById("lb-opce"));
}

init();
