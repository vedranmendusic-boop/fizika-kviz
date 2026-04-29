// ============================================
// LEADERBOARD — jednostavna stabilna verzija
// Čita direktno iz Realtime Database REST API-ja.
// Ne koristi Auth, ne koristi onValue, ne može prikazati samo prvi child.
// ============================================

const DB_URL = "https://fizika-challenge-757f7-default-rtdb.europe-west1.firebasedatabase.app";

const CATS = {
  fizika7: { path: "results/fizika7", el: "lb-fizika7" },
  fizika8: { path: "results/fizika8", el: "lb-fizika8" },
  opce:    { path: "results/opce",    el: "lb-opce" }
};

function formatTime(ms) {
  const totalSec = Math.floor((Number(ms) || 0) / 1000);
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
  d.textContent = String(str ?? "");
  return d.innerHTML;
}

function sortResults(results) {
  return results.sort((a, b) => {
    const scoreDiff = (Number(b.score) || 0) - (Number(a.score) || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (Number(a.timeMs) || 0) - (Number(b.timeMs) || 0);
  });
}

function normalizeResults(data) {
  if (!data || typeof data !== "object") return [];

  return Object.entries(data)
    .filter(([key, value]) => key.startsWith("-") && value && typeof value === "object")
    .map(([key, value]) => ({
      id: key,
      name: value.name ?? "—",
      score: Number(value.score) || 0,
      percentage: Number(value.percentage) || 0,
      timeMs: Number(value.timeMs) || 0,
      createdAt: value.createdAt ?? null,
      uid: value.uid ?? ""
    }));
}

function renderTable(el, results) {
  if (!el) return;

  if (!results.length) {
    el.innerHTML = `<div class="lb-empty">Još nema rezultata</div>`;
    return;
  }

  const sorted = sortResults([...results]).slice(0, 10);

  let html = `
    <div class="lb-row header">
      <span>#</span>
      <span>Ime</span>
      <span style="text-align:right">Bodovi</span>
      <span style="text-align:right">Vrijeme</span>
    </div>`;

  sorted.forEach((entry, index) => {
    html += `
      <div class="lb-row">
        <span class="lb-rank">${rankDisplay(index + 1)}</span>
        <span class="lb-name">${escapeHtml(entry.name)}</span>
        <span class="lb-score">${entry.score}/20</span>
        <span class="lb-time">${formatTime(entry.timeMs)}</span>
      </div>`;
  });

  el.innerHTML = html;
}

async function loadCategory(catKey) {
  const cat = CATS[catKey];
  const el = document.getElementById(cat.el);

  try {
    const url = `${DB_URL}/${cat.path}.json`;
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const results = normalizeResults(data);

    console.log(`[leaderboard] ${catKey}:`, results.length, "rezultat(a)", results);
    renderTable(el, results);
  } catch (err) {
    console.error(`[leaderboard] greška za ${catKey}:`, err);
    if (el) {
      el.innerHTML = `<div class="lb-empty">Greška učitavanja: ${escapeHtml(err.message)}</div>`;
    }
  }
}

function loadAll() {
  Object.keys(CATS).forEach(loadCategory);
}

loadAll();
setInterval(loadAll, 5000);
