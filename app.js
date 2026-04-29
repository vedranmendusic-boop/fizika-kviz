// ============================================
// KVIZ CHALLENGE — app.js
// 3 kategorije, 20 pitanja po kvizu
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { getAuth, signInAnonymously }
  from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";
import { getDatabase, ref, push, serverTimestamp }
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
// Kategorije
// --------------------------------------------------
const CATEGORIES = {
  fizika7: {
    file: "questions-7.json",
    dbPath: "results/fizika7",
    label: "Fizika 7",
    icon: "⚛️"
  },
  fizika8: {
    file: "questions-8.json",
    dbPath: "results/fizika8",
    label: "Fizika 8",
    icon: "🔬"
  },
  opce: {
    file: "questions-opce.json",
    dbPath: "results/opce",
    label: "Opće znanje",
    icon: "🧠"
  }
};

const QUESTIONS_PER_QUIZ = 20;

// --------------------------------------------------
// Stanje
// --------------------------------------------------
let allQuestions = [];
let quizQuestions = [];
let currentIndex = 0;
let score = 0;
let timerInterval = null;
let startTime = 0;
let elapsedMs = 0;
let resultSaved = false;
let currentUser = null;
let currentCategory = null;

// --------------------------------------------------
// DOM
// --------------------------------------------------
const $welcome       = document.getElementById("screen-welcome");
const $quiz          = document.getElementById("screen-quiz");
const $result        = document.getElementById("screen-result");
const $btnFizika7    = document.getElementById("btn-fizika7");
const $btnFizika8    = document.getElementById("btn-fizika8");
const $btnOpce       = document.getElementById("btn-opce");
const $categoryLabel = document.getElementById("category-label");
const $progressFill  = document.getElementById("progress-fill");
const $counter       = document.getElementById("question-counter");
const $timer         = document.getElementById("timer");
const $questionText  = document.getElementById("question-text");
const $answersGrid   = document.getElementById("answers-grid");
const $resultEmoji   = document.getElementById("result-emoji");
const $resultScore   = document.getElementById("result-score");
const $resultDetail  = document.getElementById("result-detail");
const $nameInput     = document.getElementById("name-input");
const $btnSave       = document.getElementById("btn-save");
const $saveStatus    = document.getElementById("save-status");
const $btnRetry      = document.getElementById("btn-retry");

// --------------------------------------------------
// Pomoćne
// --------------------------------------------------
function showScreen(screen) {
  [$welcome, $quiz, $result].forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function getResultEmoji(pct) {
  if (pct === 100) return "🏆";
  if (pct >= 80)  return "🌟";
  if (pct >= 60)  return "👍";
  if (pct >= 40)  return "🤔";
  return "💪";
}

// --------------------------------------------------
// Pokretanje kategorije
// --------------------------------------------------
async function startCategory(catKey) {
  currentCategory = catKey;
  const cat = CATEGORIES[catKey];

  try {
    const res = await fetch(cat.file);
    if (!res.ok) throw new Error("Greška pri učitavanju.");
    allQuestions = await res.json();
  } catch (err) {
    console.error("Greška:", err);
    alert("Ne mogu učitati pitanja. Provjeri da datoteka " + cat.file + " postoji.");
    return;
  }

  // Odaberi 20 nasumičnih (ili koliko ih ima ako je manje od 20)
  const count = Math.min(QUESTIONS_PER_QUIZ, allQuestions.length);
  quizQuestions = shuffle(allQuestions).slice(0, count);
  currentIndex = 0;
  score = 0;
  resultSaved = false;
  elapsedMs = 0;
  $saveStatus.textContent = "";

  $categoryLabel.textContent = `${cat.icon} ${cat.label}`;

  startTime = Date.now();
  timerInterval = setInterval(() => {
    elapsedMs = Date.now() - startTime;
    $timer.textContent = formatTime(elapsedMs);
  }, 250);

  showScreen($quiz);
  renderQuestion();
}

// --------------------------------------------------
// Prikaz pitanja
// --------------------------------------------------
function renderQuestion() {
  const q = quizQuestions[currentIndex];
  const total = quizQuestions.length;

  $progressFill.style.width = `${((currentIndex) / total) * 100}%`;
  $counter.textContent = `${currentIndex + 1} / ${total}`;
  $questionText.textContent = q.question;

  const letters = ["A", "B", "C", "D"];
  $answersGrid.innerHTML = "";

  q.answers.forEach((answer, i) => {
    const btn = document.createElement("button");
    btn.className = "answer-btn";
    btn.innerHTML = `
      <span class="answer-letter">${letters[i]}</span>
      <span>${answer}</span>
    `;
    btn.addEventListener("click", () => handleAnswer(i, btn));
    $answersGrid.appendChild(btn);
  });
}

// --------------------------------------------------
// Obrada odgovora
// --------------------------------------------------
function handleAnswer(selectedIndex, selectedBtn) {
  const q = quizQuestions[currentIndex];
  const allBtns = $answersGrid.querySelectorAll(".answer-btn");

  allBtns.forEach(b => b.disabled = true);
  allBtns[q.correct].classList.add("correct");

  if (selectedIndex === q.correct) {
    score++;
  } else {
    selectedBtn.classList.add("wrong");
  }

  setTimeout(() => {
    currentIndex++;
    if (currentIndex < quizQuestions.length) {
      renderQuestion();
    } else {
      endQuiz();
    }
  }, 800);
}

// --------------------------------------------------
// Završetak
// --------------------------------------------------
function endQuiz() {
  clearInterval(timerInterval);
  elapsedMs = Date.now() - startTime;

  const total = quizQuestions.length;
  const pct = Math.round((score / total) * 100);
  const cat = CATEGORIES[currentCategory];

  $resultEmoji.textContent = getResultEmoji(pct);
  $resultScore.textContent = `${score} / ${total}`;
  $resultDetail.textContent = `${cat.icon} ${cat.label} · ${pct}% · ${formatTime(elapsedMs)}`;
  $progressFill.style.width = "100%";

  $nameInput.value = "";
  $btnSave.disabled = false;

  showScreen($result);
}

// --------------------------------------------------
// Spremanje
// --------------------------------------------------
async function saveResult() {
  if (resultSaved) {
    $saveStatus.textContent = "Rezultat je već spremljen!";
    return;
  }

  const name = $nameInput.value.trim();
  if (!name) {
    $saveStatus.textContent = "Upiši ime ili inicijale!";
    $saveStatus.style.color = "var(--warning)";
    return;
  }

  $btnSave.disabled = true;
  $saveStatus.textContent = "Spremam…";
  $saveStatus.style.color = "var(--text-secondary)";

  const total = quizQuestions.length;
  const pct = Math.round((score / total) * 100);
  const cat = CATEGORIES[currentCategory];

  try {
    if (!auth.currentUser) {
      const cred = await signInAnonymously(auth);
      currentUser = cred.user;
    } else {
      currentUser = auth.currentUser;
    }

    const savedRef = await push(ref(db, cat.dbPath), {
      name: name,
      score: score,
      percentage: pct,
      timeMs: elapsedMs,
      createdAt: serverTimestamp(),
      uid: currentUser.uid
    });

    console.log("SPREMLJEN REZULTAT:", cat.dbPath, savedRef.key);

    resultSaved = true;
    $saveStatus.textContent = "✅ Rezultat spremljen!";
    $saveStatus.style.color = "var(--success)";
  } catch (err) {
    console.error("Greška:", err);
    $saveStatus.textContent = "Greška: " + (err && err.code ? err.code : "spremanje nije uspjelo");
    $saveStatus.style.color = "var(--danger)";
    $btnSave.disabled = false;
  }
}

// --------------------------------------------------
// Event listeneri
// --------------------------------------------------
$btnFizika7.addEventListener("click", () => startCategory("fizika7"));
$btnFizika8.addEventListener("click", () => startCategory("fizika8"));
$btnOpce.addEventListener("click", () => startCategory("opce"));
$btnSave.addEventListener("click", saveResult);
$btnRetry.addEventListener("click", () => showScreen($welcome));
$nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") saveResult(); });

// Firebase prijava
(async () => {
  try {
    const cred = await signInAnonymously(auth);
    currentUser = cred.user;
  } catch (err) {
    console.error("Auth greška:", err);
  }
})();
