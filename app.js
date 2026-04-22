// ============================================
// FIZIKA CHALLENGE — app.js
// Glavni kviz: učitavanje pitanja, timer,
// bodovanje, spremanje rezultata u Firebase
// ============================================

// --------------------------------------------------
// 1. Firebase inicijalizacija (modularni SDK)
// --------------------------------------------------
//    ⚠️  UPUTA: Zamijeni firebaseConfig svojim
//    podatcima iz Firebase Console → Project Settings
// --------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { getAuth, signInAnonymously }
  from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";
import { getDatabase, ref, push, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/11.7.1/firebase-database.js";

// ⬇️ ZAMIJENI OVIM SVOJIM FIREBASE KONFIGURACIJOM ⬇️
const firebaseConfig = {
  apiKey: "AIzaSyD7MxLO2H0BLSgu07mxh7cYg3d2XM91WeI",
  authDomain: "fizika-challenge-757f7.firebaseapp.com",
  projectId: "fizika-challenge-757f7",
  storageBucket: "fizika-challenge-757f7.firebasestorage.app",
  messagingSenderId: "462864759911",
  appId: "1:462864759911:web:5e47b89c750232f81368c2"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);

// --------------------------------------------------
// 2. Globalne varijable stanja
// --------------------------------------------------
let allQuestions = [];       // Sva pitanja iz JSON-a
let quizQuestions = [];      // 10 nasumičnih za ovaj pokušaj
let currentIndex = 0;        // Indeks trenutnog pitanja
let score = 0;               // Broj točnih odgovora
let timerInterval = null;    // Interval za štopericu
let startTime = 0;           // Početak kviza (ms)
let elapsedMs = 0;           // Proteklo vrijeme (ms)
let resultSaved = false;     // Zaštita od dvostrukog spremanja
let currentUser = null;      // Firebase anonimni korisnik

// --------------------------------------------------
// 3. DOM elementi
// --------------------------------------------------
const $welcome      = document.getElementById("screen-welcome");
const $quiz         = document.getElementById("screen-quiz");
const $result        = document.getElementById("screen-result");
const $btnStart      = document.getElementById("btn-start");
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
// 4. Pomoćne funkcije
// --------------------------------------------------

/** Prikaži jedan ekran, sakrij ostale */
function showScreen(screen) {
  [$welcome, $quiz, $result].forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}

/** Fisher-Yates shuffle za nasumičan odabir pitanja */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Formatiraj milisekunde u MM:SS */
function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/** Emoji na temelju postotka */
function getResultEmoji(pct) {
  if (pct === 100) return "🏆";
  if (pct >= 80)  return "🌟";
  if (pct >= 60)  return "👍";
  if (pct >= 40)  return "🤔";
  return "💪";
}

// --------------------------------------------------
// 5. Učitavanje pitanja iz JSON datoteke
// --------------------------------------------------
async function loadQuestions() {
  try {
    const res = await fetch("questions.json");
    if (!res.ok) throw new Error("Nije moguće učitati pitanja.");
    allQuestions = await res.json();
    console.log(`Učitano ${allQuestions.length} pitanja.`);
  } catch (err) {
    console.error("Greška pri učitavanju pitanja:", err);
    $btnStart.textContent = "Greška ❌";
    return;
  }

  // Aktiviraj gumb za start
  $btnStart.textContent = "🚀 Započni kviz";
  $btnStart.disabled = false;
}

// --------------------------------------------------
// 6. Firebase anonimna prijava
// --------------------------------------------------
async function signIn() {
  try {
    const cred = await signInAnonymously(auth);
    currentUser = cred.user;
    console.log("Anonimna prijava:", currentUser.uid);
  } catch (err) {
    console.error("Firebase Auth greška:", err);
  }
}

// --------------------------------------------------
// 7. Pokretanje kviza
// --------------------------------------------------
function startQuiz() {
  // Odaberi 10 nasumičnih pitanja
  quizQuestions = shuffle(allQuestions).slice(0, 10);
  currentIndex = 0;
  score = 0;
  resultSaved = false;
  elapsedMs = 0;
  $saveStatus.textContent = "";

  // Pokreni štopericu
  startTime = Date.now();
  timerInterval = setInterval(() => {
    elapsedMs = Date.now() - startTime;
    $timer.textContent = formatTime(elapsedMs);
  }, 250);

  showScreen($quiz);
  renderQuestion();
}

// --------------------------------------------------
// 8. Prikaz pitanja
// --------------------------------------------------
function renderQuestion() {
  const q = quizQuestions[currentIndex];
  const total = quizQuestions.length;

  // Ažuriraj progress bar i brojač
  $progressFill.style.width = `${((currentIndex) / total) * 100}%`;
  $counter.textContent = `${currentIndex + 1} / ${total}`;

  // Postavi tekst pitanja
  $questionText.textContent = q.question;

  // Generiraj gumbe za odgovore
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
// 9. Obrada odgovora
// --------------------------------------------------
function handleAnswer(selectedIndex, selectedBtn) {
  const q = quizQuestions[currentIndex];
  const allBtns = $answersGrid.querySelectorAll(".answer-btn");

  // Onemogući sve gumbe
  allBtns.forEach(b => b.disabled = true);

  // Označi točan odgovor
  allBtns[q.correct].classList.add("correct");

  // Provjeri je li odgovor točan
  if (selectedIndex === q.correct) {
    score++;
  } else {
    selectedBtn.classList.add("wrong");
  }

  // Pauza pa sljedeće pitanje
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
// 10. Završetak kviza
// --------------------------------------------------
function endQuiz() {
  // Zaustavi štopericu
  clearInterval(timerInterval);
  elapsedMs = Date.now() - startTime;

  const total = quizQuestions.length;
  const pct = Math.round((score / total) * 100);

  // Prikaz rezultata
  $resultEmoji.textContent = getResultEmoji(pct);
  $resultScore.textContent = `${score} / ${total}`;
  $resultDetail.textContent = `${pct}% točno · ${formatTime(elapsedMs)}`;
  $progressFill.style.width = "100%";

  // Resetiraj input
  $nameInput.value = "";
  $btnSave.disabled = false;

  showScreen($result);
}

// --------------------------------------------------
// 11. Spremanje rezultata u Firebase
// --------------------------------------------------
async function saveResult() {
  // Zaštita od dvostrukog spremanja
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

  try {
    const resultsRef = ref(db, "results");
    await push(resultsRef, {
      name: name,
      score: score,
      percentage: pct,
      timeMs: elapsedMs,
      createdAt: serverTimestamp(),
      uid: currentUser ? currentUser.uid : "unknown"
    });

    resultSaved = true;
    $saveStatus.textContent = "✅ Rezultat spremljen!";
    $saveStatus.style.color = "var(--success)";
  } catch (err) {
    console.error("Greška pri spremanju:", err);
    $saveStatus.textContent = "Greška. Pokušaj ponovo.";
    $saveStatus.style.color = "var(--danger)";
    $btnSave.disabled = false;
  }
}

// --------------------------------------------------
// 12. Event listeneri
// --------------------------------------------------
$btnStart.addEventListener("click", startQuiz);
$btnSave.addEventListener("click", saveResult);
$btnRetry.addEventListener("click", () => {
  showScreen($welcome);
});

// Enter tipka za spremanje
$nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveResult();
});

// --------------------------------------------------
// 13. Inicijalizacija
// --------------------------------------------------
loadQuestions();
signIn();
