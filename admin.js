// ============================================
// ADMIN — jednostavna stabilna verzija
// Čitanje radi preko REST API-ja kao leaderboard.
// Brisanje/uređivanje koristi Firebase SDK + anonymous auth.
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { getAuth, signInAnonymously }
  from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";
import { getDatabase, ref, remove, update }
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

const DB_URL = "https://fizika-challenge-757f7-default-rtdb.europe-west1.firebasedatabase.app";

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);

const ADMIN_PIN = "1991";

const CATS = {
  fizika7: { path: "results/fizika7", label: "⚛️ Fizika 7" },
  fizika8: { path: "results/fizika8", label: "🔬 Fizika 8" },
  opce:    { path: "results/opce",    label: "🧠 Opće znanje" }
};

let data = { fizika7: [], fizika8: [], opce: [] };
let activeCategory = "fizika7";
let editingKey = null;
let deleteTarget = null;
let pollingStarted = false;
let authReady = false;

const $ = id => document.getElementById(id);

const $screenLogin=$("screen-login"), $screenAdmin=$("screen-admin"),
  $pinInput=$("pin-input"), $pinError=$("pin-error"),
  $adminContent=$("admin-content"), $resultCount=$("result-count"),
  $btnDeleteAll=$("btn-delete-all"),
  $modalEdit=$("modal-edit"), $editName=$("edit-name"),
  $editScore=$("edit-score"), $editTime=$("edit-time"),
  $modalConfirm=$("modal-confirm"), $confirmText=$("confirm-text");

function showScreen(s){[$screenLogin,$screenAdmin].forEach(x=>x.classList.remove("active"));s.classList.add("active");}
function formatTime(ms){const t=Math.floor((Number(ms)||0)/1000);return`${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`;}
function escapeHtml(s){const d=document.createElement("div");d.textContent=String(s ?? "");return d.innerHTML;}
function sortResults(r){return r.sort((a,b)=>{const sd=(Number(b.score)||0)-(Number(a.score)||0);return sd!==0?sd:(Number(a.timeMs)||0)-(Number(b.timeMs)||0);});}

function normalizeResults(raw){
  if(!raw || typeof raw !== "object") return [];
  return Object.entries(raw)
    .filter(([key,val])=>key.startsWith("-") && val && typeof val === "object")
    .map(([key,val])=>({
      key,
      name: val.name ?? "—",
      score: Number(val.score)||0,
      percentage: Number(val.percentage)||0,
      timeMs: Number(val.timeMs)||0,
      createdAt: val.createdAt ?? null,
      uid: val.uid ?? ""
    }));
}

async function loadCategory(catKey){
  const cat = CATS[catKey];
  const url = `${DB_URL}/${cat.path}.json`;
  try{
    const res = await fetch(url, { cache: "no-store" });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    data[catKey] = normalizeResults(raw);
    console.log(`[admin] ${catKey}: ${data[catKey].length} rezultat(a)`);
    if(activeCategory === catKey) renderAdmin();
  }catch(err){
    console.error("Admin read greška:", catKey, err);
    if(activeCategory === catKey){
      $adminContent.innerHTML=`<div class="lb-empty">Greška učitavanja: ${escapeHtml(err.message)}</div>`;
    }
  }
}

function loadAll(){ Object.keys(CATS).forEach(loadCategory); }

function renderAdmin(){
  const results=data[activeCategory] || [];
  const sorted=sortResults([...results]);
  const cat=CATS[activeCategory];
  $resultCount.textContent=`${cat.label} — ${sorted.length} rezultat(a)`;

  if(!sorted.length){$adminContent.innerHTML=`<div class="lb-empty">Nema rezultata.</div>`;return;}

  let html=`<div class="admin-row header"><span>Ime</span><span style="text-align:center">Bod.</span><span style="text-align:center">Vrijeme</span><span style="text-align:right">Akcije</span></div>`;
  sorted.forEach(e=>{
    html+=`<div class="admin-row"><span class="admin-name">${escapeHtml(e.name||'—')}</span><span class="admin-score">${e.score}/20</span><span class="admin-time">${formatTime(e.timeMs||0)}</span><div class="admin-actions"><button class="btn-icon edit" onclick="window._edit('${e.key}')">✏️</button><button class="btn-icon" onclick="window._delete('${e.key}','${escapeHtml(e.name||'—')}')">✕</button></div></div>`;
  });
  $adminContent.innerHTML=html;
}

// PIN
$pinInput.addEventListener("input",()=>{
  $pinError.textContent="";
  if($pinInput.value.length===4){
    if($pinInput.value===ADMIN_PIN){showScreen($screenAdmin);initAdmin();}
    else{$pinError.textContent="Krivi PIN!";$pinInput.value="";}
  }
});
$pinInput.focus();

// Tabs
document.querySelectorAll(".admin-tab").forEach(tab=>{
  tab.addEventListener("click",()=>{
    activeCategory=tab.dataset.cat;
    document.querySelectorAll(".admin-tab").forEach(t=>t.classList.remove("active"));
    tab.classList.add("active");
    renderAdmin();
    loadCategory(activeCategory);
  });
});

async function initAdmin(){
  if(pollingStarted) return;
  pollingStarted = true;

  const uidEl = document.getElementById("admin-uid");
  try{
    const cred = auth.currentUser ? { user: auth.currentUser } : await signInAnonymously(auth);
    authReady = true;
    if(uidEl) uidEl.textContent = `Auth OK · UID: ${cred.user.uid}`;
  }catch(err){
    authReady = false;
    if(uidEl) uidEl.textContent = `Čitanje radi · brisanje/uređivanje možda neće raditi bez Auth-a`;
    console.warn("Auth greška u adminu:", err);
  }

  loadAll();
  setInterval(loadAll, 3000);
}

// Delete
window._delete=(key,name)=>{deleteTarget={key,name};$confirmText.textContent=`Obrisati "${name}"?`;$modalConfirm.classList.add("active");};

$btnDeleteAll.addEventListener("click",()=>{
  if(!data[activeCategory].length)return;
  deleteTarget="all";
  $confirmText.textContent=`Obrisati SVE iz ${CATS[activeCategory].label} (${data[activeCategory].length})?`;
  $modalConfirm.classList.add("active");
});

$("btn-confirm-delete").addEventListener("click",async()=>{
  if(!deleteTarget)return;
  try{
    if(!authReady && !auth.currentUser){
      const cred = await signInAnonymously(auth);
      authReady = true;
      const uidEl = document.getElementById("admin-uid");
      if(uidEl) uidEl.textContent = `Auth OK · UID: ${cred.user.uid}`;
    }
    if(deleteTarget==="all") {
      const items = [...data[activeCategory]];
      for (const item of items) await remove(ref(db,`${CATS[activeCategory].path}/${item.key}`));
    } else {
      await remove(ref(db,`${CATS[activeCategory].path}/${deleteTarget.key}`));
    }
    await loadCategory(activeCategory);
  }catch(e){alert("Greška brisanja: "+e.message);}
  deleteTarget=null;$modalConfirm.classList.remove("active");
});

$("btn-confirm-cancel").addEventListener("click",()=>{deleteTarget=null;$modalConfirm.classList.remove("active");});
$modalConfirm.addEventListener("click",e=>{if(e.target===$modalConfirm){deleteTarget=null;$modalConfirm.classList.remove("active");}});

// Edit
window._edit=(key)=>{
  const entry=data[activeCategory].find(r=>r.key===key);if(!entry)return;
  editingKey=key;$editName.value=entry.name||"";$editScore.value=entry.score??0;$editTime.value=entry.timeMs??0;
  $modalEdit.classList.add("active");$editName.focus();
};

$("btn-edit-save").addEventListener("click",async()=>{
  if(!editingKey)return;
  const name=$editName.value.trim(),score=parseInt($editScore.value,10),timeMs=parseInt($editTime.value,10);
  if(!name){alert("Ime!");return;}
  if(isNaN(score)||score<0||score>20){alert("Bodovi: 0–20!");return;}
  if(isNaN(timeMs)||timeMs<=0){alert("Vrijeme mora biti veće od 0!");return;}
  try{
    if(!authReady && !auth.currentUser){
      const cred = await signInAnonymously(auth);
      authReady = true;
      const uidEl = document.getElementById("admin-uid");
      if(uidEl) uidEl.textContent = `Auth OK · UID: ${cred.user.uid}`;
    }
    await update(ref(db,`${CATS[activeCategory].path}/${editingKey}`),{name,score,percentage:Math.round((score/20)*100),timeMs});
    await loadCategory(activeCategory);
  }
  catch(e){alert("Greška uređivanja: "+e.message);}
  editingKey=null;$modalEdit.classList.remove("active");
});

$("btn-edit-cancel").addEventListener("click",()=>{editingKey=null;$modalEdit.classList.remove("active");});
$modalEdit.addEventListener("click",e=>{if(e.target===$modalEdit){editingKey=null;$modalEdit.classList.remove("active");}});
