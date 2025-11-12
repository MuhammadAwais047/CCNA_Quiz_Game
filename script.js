/* script.js - Full Integration PWA
 - Loads /data.json (your uploaded JSON)
 - Supports: quiz, subnet, labs (CLI), drag-drop, simulations, troubleshooting
 - Uses embedded base64 audio for click/correct/wrong (ON)
*/

// --- CONSTANTS AND STATE ---
const DATA_URL = '/data.json';
const CACHE_KEY = 'ccnaProgress';

let DATA = null;
const state = {
  quizOrder: [], quizPos: 0, usedQ: new Set(), quizTimer: null, quizStart: null,
  subnetPos: 0, labPos: 0, dragPos: 0, simPos: 0, trblPos: 0,
  sound: true
};

// --- DOM & AUDIO HELPERS ---
const $ = id => document.getElementById(id);
const play = (id) => {
  if (!state.sound) return;
  const a = $(id);
  if (!a) return;
  try { a.currentTime = 0; a.play().catch(()=>{}); } catch(e){}
};

// Background music control (Improved with sound state update)
const bgMusic = document.getElementById('bgMusic');
function toggleMusic() {
  if (!bgMusic) return;
  if (bgMusic.paused) {
    bgMusic.volume = 0.3; // adjust volume 0.0 - 1.0
    bgMusic.play().catch(() => {});
  } else {
    bgMusic.pause();
  }
  // Update state and UI
  state.sound = !state.sound;
  $('soundState').textContent = state.sound ? 'On' : 'Off';
  $('soundState').classList.toggle('active', state.sound);
  saveProgress();
}

// --- INITIALIZATION ---
window.addEventListener('load', async () => {
  // install SW
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(console.warn);
  }

  // install prompt
  window.deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPrompt = e;
    $('installBtn').classList.remove('hidden');
  });
  $('installBtn').onclick = async () => {
    if (!window.deferredPrompt) return;
    window.deferredPrompt.prompt();
    const choice = await window.deferredPrompt.userChoice;
    window.deferredPrompt = null;
    $('installBtn').classList.add('hidden');
  };

  // bind menu buttons
  document.querySelectorAll('.mode-btn').forEach(b => b.addEventListener('click', () => { play('sClick'); openMode(b.dataset.mode); }));
  $('resetBtn').addEventListener('click', resetProgress);
  $('bgMusic').volume = 0.3; // Ensure initial volume is set
  // Bind music toggle to the button in the grid
  document.querySelector('.grid button:nth-child(7)').addEventListener('click', toggleMusic);

  // load data
  await loadData();
  // init totals
  $('totalQuestions').textContent = (DATA.questions || []).length;
  // restore progress
  loadProgress();
  // show menu
  show('menu');
});

// Fetch data.json
async function loadData(){
  try {
    // Cache-busting might be redundant with SW Network-first, but safe for browser cache
    const r = await fetch(DATA_URL + '?v=' + Date.now(), {cache:'no-store'});
    if (!r.ok) throw new Error('no data');
    DATA = await r.json();
  } catch(e) {
    console.warn('Failed to load /data.json, falling back to empty skeleton.', e);
    DATA = { questions: [], subnetting: [], labs: [], drag_drop: [], simulation: [], troubleshooting: [] };
  }
}

// --- NAVIGATION ---
function hideAll(){ ['menu','quiz','subnet','labs','drag','sim','trbl'].forEach(id => $(id).classList.add('hidden')); }
function show(id){ hideAll(); $(id).classList.remove('hidden'); }
function goMenu(){ saveProgress(); show('menu'); }
function openMode(mode){
  saveProgress();
  if (mode === 'quiz') startQuiz();
  else if (mode === 'subnet') openSubnet();
  else if (mode === 'labs') openLabs();
  else if (mode === 'drag') openDrag();
  else if (mode === 'sim') openSim();
  else if (mode === 'trbl') openTrbl();
}

// --- PROGRESS STORAGE ---
function saveProgress(){
  const p = {
    usedQ: Array.from(state.usedQ),
    subnetPos: state.subnetPos,
    labPos: state.labPos,
    dragPos: state.dragPos,
    simPos: state.simPos,
    trblPos: state.trblPos,
    sound: state.sound,
    musicPaused: bgMusic ? bgMusic.paused : true
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(p));
}
function loadProgress(){
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    state.usedQ = new Set(p.usedQ || []);
    state.subnetPos = p.subnetPos || 0;
    state.labPos = p.labPos || 0;
    state.dragPos = p.dragPos || 0;
    state.simPos = p.simPos || 0;
    state.trblPos = p.trblPos || 0;
    state.sound = p.sound !== undefined ? p.sound : true;
    
    // Restore sound and music state
    $('soundState').textContent = state.sound ? 'On' : 'Off';
    $('soundState').classList.toggle('active', state.sound);
    if (bgMusic) {
        if (p.musicPaused === false) {
            bgMusic.play().catch(() => {});
        } else {
            bgMusic.pause();
        }
    }
  } catch(e){ console.error("Error loading progress:", e); }
}
function resetProgress(){
  if (!confirm('Reset saved progress?')) return;
  localStorage.removeItem(CACHE_KEY);
  state.usedQ = new Set();
  state.subnetPos = state.labPos = state.dragPos = state.simPos = state.trblPos = 0;
  saveProgress();
  alert('Progress reset. Reloading data.');
  window.location.reload(); // Simple reload to fully reset the UI
}

// ----------------- QUIZ -----------------
function startQuiz(){
  // prepare order
  const qarr = (DATA.questions || []).map((q,i) => ({ idx: i, id: q.id || i }));
  // shuffle
  for (let i = qarr.length -1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [qarr[i], qarr[j]] = [qarr[j], qarr[i]];
  }
  state.quizOrder = qarr;
  state.quizPos = 0;
  state.quizStart = Date.now();
  $('quizTimer').textContent = '00:00';
  if (state.quizTimer) clearInterval(state.quizTimer);
  state.quizTimer = setInterval(updateQuizTimer, 1000);
  $('quizCount').textContent = state.quizOrder.length;
  show('quiz');
  loadNextQuizQ();
}
function updateQuizTimer(){
  if (!state.quizStart) return;
  const elapsed = Math.floor((Date.now() - state.quizStart)/1000);
  const m = String(Math.floor(elapsed/60)).padStart(2,'0');
  const s = String(elapsed%60).padStart(2,'0');
  $('quizTimer').textContent = `${m}:${s}`;
}
function loadNextQuizQ(){
  if (state.quizPos >= state.quizOrder.length){
    endQuiz();
    return;
  }
  const idx = state.quizOrder[state.quizPos].idx;
  const q = DATA.questions[idx];
  if (!q) { state.quizPos++; return loadNextQuizQ(); }
  
  // Set question content
  $('quizQ').textContent = `${state.quizPos+1}/${state.quizOrder.length}. ${q.q || q.question}`;
  const opts = q.o || q.options;
  const container = $('quizOpts');
  container.innerHTML = '';
  
  // Create options
  opts.forEach((opt, i) => {
    const d = document.createElement('div');
    d.className = 'opt';
    d.textContent = opt;
    d.onclick = () => answerQ(q, i, d);
    container.appendChild(d);
  });
  $('quizExplain').classList.add('hidden');
}
function answerQ(q, i, elNode){
  // disable opts
  [...$('quizOpts').children].forEach(c => c.style.pointerEvents='none');
  const correct = q.a !== undefined ? q.a : (q.correct !== undefined ? q.correct : 0);
  if (i === correct){
    elNode.classList.add('correct');
    play('sCorrect');
  } else {
    elNode.classList.add('wrong');
    // highlight correct
    const children = [...$('quizOpts').children];
    if (children[correct]) children[correct].classList.add('correct');
    play('sWrong');
  }
  // show explanation if exists
  const explanation = q.e || q.explanation || q.explain;
  if (explanation){
    $('quizExplain').textContent = explanation;
    $('quizExplain').classList.remove('hidden');
  }
  // mark used (using question ID or index)
  state.usedQ.add(q.id || state.quizOrder[state.quizPos].id);
  saveProgress();
  setTimeout(() => { state.quizPos++; loadNextQuizQ(); }, 1200); // Increased delay for better feedback visibility
}
function skipQ(){
  state.quizPos++;
  loadNextQuizQ();
}
function endQuiz(){
  if (state.quizTimer) { clearInterval(state.quizTimer); state.quizTimer = null; state.quizStart = null; }
  alert('Quiz finished. Your progress has been saved.');
  saveProgress();
  goMenu();
}

// ----------------- SUBNET -----------------
function openSubnet(){
  show('subnet');
  renderSubnet();
}
function renderSubnet(){
  const list = DATA.subnetting || [];
  if (!list.length) { $('subnetQ').textContent = 'No subnetting items in data.'; return; }
  const item = list[state.subnetPos % list.length];
  $('subnetQ').textContent = `${state.subnetPos+1}/${list.length}. ${item.q || item.question}`;
  $('subnetAns').value = '';
  $('subnetFeedback').classList.add('hidden');
  $('subnetAns').classList.remove('subnet-success', 'subnet-error'); // Clear previous visual feedback
}
function checkSubnet(){
  const inputEl = $('subnetAns');
  const val = inputEl.value.trim();
  const item = (DATA.subnetting || [])[state.subnetPos % (DATA.subnetting||[]).length];
  if (!item) return;
  
  // Ensure comparison is case/whitespace insensitive and handles potential array answers
  const correct = Array.isArray(item.a) ? item.a.map(s => String(s).toLowerCase().trim()) : [String(item.a).toLowerCase().trim()];
  const isCorrect = correct.includes(val.toLowerCase());

  if (isCorrect){
    $('subnetFeedback').textContent = `✅ Correct! ${item.e || ''}`;
    inputEl.classList.add('subnet-success');
    play('sCorrect');
  } else {
    // Show one correct answer if wrong
    const correctDisplay = Array.isArray(item.a) ? item.a[0] : item.a;
    $('subnetFeedback').textContent = `❌ Wrong. Expected: ${correctDisplay}. ${item.e || ''}`;
    inputEl.classList.add('subnet-error');
    play('sWrong');
  }
  $('subnetFeedback').classList.remove('hidden');
  saveProgress();
}
function nextSubnet(){ state.subnetPos++; renderSubnet(); saveProgress(); }

// ----------------- LABS (CLI) -----------------
function openLabs(){
  show('labs');
  renderLab();
}
function renderLab(){
  const labs = DATA.labs || [];
  if (!labs.length) { $('labScenario').textContent = 'No labs imported.'; return; }
  const lab = labs[state.labPos % labs.length];
  $('labScenario').textContent = `${state.labPos+1}/${labs.length}. ${lab.name} — ${lab.scenario || ''}`;
  clearTerminal();
  $('labFeedback').classList.add('hidden');
}
function clearTerminal(){ $('terminal').textContent = ''; }
function runCLI(){
  const txt = $('cliInput').value || '';
  if (!txt.trim()) return;
  const lines = txt.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  lines.forEach(l => writeTerm(`R1# ${l}`));
  $('cliInput').value = '';
  play('sClick');
}
function writeTerm(line){ const t = $('terminal'); const div = document.createElement('div'); div.textContent = line; t.appendChild(div); t.scrollTop = t.scrollHeight; }
function verifyLab(){
  const lab = (DATA.labs || [])[state.labPos % (DATA.labs||[]).length];
  if (!lab) return;
  const sol = (lab.solution || lab.cli || '').toString().split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const terminalText = $('terminal').textContent.toLowerCase();
  
  let ok = true;
  let missingCommands = [];

  // Check if all required solution lines were entered
  sol.forEach(line => { 
    if (!terminalText.includes(line.toLowerCase())) {
        ok = false;
        missingCommands.push(line);
    }
  });

  if (ok){
    $('labFeedback').textContent = `✅ ${lab.feedback || 'Lab successfully completed!'}`;
    play('sCorrect');
  } else {
    // Give specific feedback on what was missing
    let feedback = `❌ Not complete. Missing commands:`;
    missingCommands.forEach(cmd => { feedback += `\n- ${cmd}`; });
    $('labFeedback').textContent = feedback;
    play('sWrong');
  }
  $('labFeedback').classList.remove('hidden');
  saveProgress();
}
function nextLab(){ state.labPos++; renderLab(); saveProgress(); }

// ----------------- DRAG & DROP (simple match)
function openDrag(){ show('drag'); renderDrag(); }
function renderDrag(){
  const list = DATA.drag_drop || [];
  if (!list.length) { $('dragQ').textContent = 'No drag_drop items.'; return; }
  const item = list[state.dragPos % list.length];
  $('dragQ').textContent = `${state.dragPos+1}/${list.length}. ${item.question || item.title || 'Match items'}`;
  const area = $('dragArea'); area.innerHTML = '';
  // Create draggable keys and target list
  const entries = Object.entries(item.items || {});
  // Shuffle keys
  const keys = entries.map(e=>e[0]).sort(()=>Math.random()-0.5);
  const targets = entries.map(e=>e[1]); // The target descriptions (right side)

  // 1. Draggable items (the Keys)
  keys.forEach(k => {
    const d = document.createElement('div');
    d.className = 'drag-item';
    d.draggable = true;
    d.textContent = k;
    d.dataset.key = k; // The actual value being dragged
    d.addEventListener('dragstart', dragStart);
    area.appendChild(d);
  });

  // 2. Target area (The Values/Descriptions)
  const targetWrap = document.createElement('div');
  targetWrap.style.marginTop = '12px';
  targetWrap.style.width = '100%';
  targets.forEach((t, i) => {
    const box = document.createElement('div');
    box.className = 'drag-target'; // Using a new class for styling targets
    box.dataset.expectedValue = keys.find(k => item.items[k] === t); // Store the correct key name
    box.textContent = 'Drop item here: ' + t;
    box.addEventListener('dragover', e => e.preventDefault());
    box.addEventListener('drop', dropToTarget);
    targetWrap.appendChild(box);
  });
  area.appendChild(targetWrap);
  $('dragFeedback').classList.add('hidden');
}
function dragStart(e){ e.dataTransfer.setData('text/plain', e.target.dataset.key); }
function dropToTarget(e){ 
  e.preventDefault(); 
  const key = e.dataTransfer.getData('text/plain'); // The dragged key (e.g., 'CIDR /24')
  const tgt = e.currentTarget; 

  // Prevent dropping multiple times or on already filled slots if desired
  // if (tgt.dataset.got) return; 

  // Store the key that was dropped
  tgt.dataset.got = key;
  tgt.textContent = `${tgt.dataset.expectedValue.split(' ')[0]} ⬅ ${key}`; // Display the key/value pair
  tgt.style.backgroundColor = 'var(--accent-2)';
  play('sClick');
}
function nextDrag(){
  // validate all targets
  const targets = [...$('dragArea').querySelectorAll('[data-expected-value]')];
  let ok = true;
  targets.forEach(t => {
    const expected = t.dataset.expectedValue; // The key we SHOULD have
    const got = t.dataset.got; // The key we DID drop

    // Give visual feedback on the target
    if (expected === got) {
        t.style.outline = '3px solid var(--accent)';
    } else {
        ok = false;
        t.style.outline = '3px solid var(--danger)';
    }
  });
  
  $('dragFeedback').textContent = ok ? '✅ Correct matches!' : '❌ Some matches are incorrect. Check highlighted boxes.';
  $('dragFeedback').classList.remove('hidden');
  if (ok) play('sCorrect'); else play('sWrong');
  
  state.dragPos++; saveProgress();
  // Do not automatically render next to allow user to review results
  // setTimeout(renderDrag, 3000); 
}

// ----------------- SIMULATIONS
function openSim(){ show('sim'); renderSim(); }
function renderSim(){
  const sims = DATA.simulation || [];
  if (!sims.length) { $('simQ').textContent='No simulations'; return; }
  const s = sims[state.simPos % sims.length];
  $('simQ').textContent = `${state.simPos+1}/${sims.length}. ${s.scenario || s.title || 'Simulation'}`;
  const tasks = $('simTasks'); tasks.innerHTML = '';
  (s.tasks || []).forEach((t,i) => {
    const div = document.createElement('div'); div.textContent = `${i+1}. ${t}`; tasks.appendChild(div);
  });
  $('simFeedback').classList.add('hidden');
}
function startSim(){ $('simFeedback').textContent='Sim started — follow tasks and use your resources. (Manual verify)'; $('simFeedback').classList.remove('hidden'); play('sClick'); }
function nextSim(){ state.simPos++; renderSim(); saveProgress(); }

// ----------------- TROUBLESHOOTING
function openTrbl(){ show('trbl'); renderTrbl(); }
function renderTrbl(){
  const arr = DATA.troubleshooting || [];
  if (!arr.length) { $('trblQ').textContent='No scenarios'; return; }
  const s = arr[state.trblPos % arr.length];
  $('trblQ').textContent = `${state.trblPos+1}/${arr.length}. ${s.scenario || s.title}`;
  const details = $('trblDetails'); details.innerHTML = '';
  
  // Helper to render sections
  const renderSection = (title, items) => {
    if (items && items.length) {
      const h = document.createElement('h3'); h.textContent = title; details.appendChild(h);
      const ul = document.createElement('ul'); 
      items.forEach(x => { 
        const li = document.createElement('li'); 
        li.textContent = x; 
        ul.appendChild(li); 
      }); 
      details.appendChild(ul);
    }
  };
  
  renderSection('Symptoms:', s.symptoms);
  renderSection('Possible Causes:', s.causes);
  renderSection('Suggested Solutions:', s.solutions);
}
function nextTrbl(){ state.trblPos++; renderTrbl(); saveProgress(); }

// ----------------- small helpers
function showMessage(msg){ alert(msg); }
