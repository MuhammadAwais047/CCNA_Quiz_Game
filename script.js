/* script.js - Full Integration PWA
 - Loads /data.json (your uploaded JSON)
 - Supports: quiz, subnet, labs (CLI), drag-drop, simulations, troubleshooting
 - Uses embedded base64 audio for click/correct/wrong (ON)
*/
// Background music control
const bgMusic = document.getElementById('bgMusic');
function toggleMusic() {
  if (!bgMusic) return;
  if (bgMusic.paused) {
    bgMusic.volume = 0.3; // adjust volume 0.0 - 1.0
    bgMusic.play().catch(() => {});
  } else {
    bgMusic.pause();
  }
}

const DATA_URL = '/data.json';

let DATA = null;
const state = {
  quizOrder: [], quizPos: 0, usedQ: new Set(), quizTimer: null, quizStart: null,
  subnetPos: 0, labPos: 0, dragPos: 0, simPos: 0, trblPos: 0,
  sound: true
};

// UI helpers
const $ = id => document.getElementById(id);
const play = (id) => {
  if (!state.sound) return;
  const a = $(id);
  if (!a) return;
  try { a.currentTime = 0; a.play().catch(()=>{}); } catch(e){}
};

// Init
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
  document.querySelectorAll('.mode-btn').forEach(b => b.addEventListener('click', () => openMode(b.dataset.mode)));
  $('resetBtn').addEventListener('click', resetProgress);

  // load data
  await loadData();
  // init totals
  $('totalQuestions').textContent = (DATA.questions || []).length;
  // show menu
  show('menu');
  // restore progress
  loadProgress();
});

// Fetch data.json
async function loadData(){
  try {
    const r = await fetch(DATA_URL, {cache:'no-store'});
    if (!r.ok) throw new Error('no data');
    DATA = await r.json();
  } catch(e) {
    console.warn('Failed to load /data.json, falling back to empty skeleton.');
    DATA = { questions: [], subnetting: [], labs: [], drag_drop: [], simulation: [], troubleshooting: [] };
  }
}

// --- Navigation
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

// --- Progress storage
function saveProgress(){
  const p = {
    usedQ: Array.from(state.usedQ),
    subnetPos: state.subnetPos,
    labPos: state.labPos,
    dragPos: state.dragPos,
    simPos: state.simPos,
    trblPos: state.trblPos,
    sound: state.sound
  };
  localStorage.setItem('ccnaProgress', JSON.stringify(p));
}
function loadProgress(){
  try {
    const raw = localStorage.getItem('ccnaProgress');
    if (!raw) return;
    const p = JSON.parse(raw);
    state.usedQ = new Set(p.usedQ || []);
    state.subnetPos = p.subnetPos || 0;
    state.labPos = p.labPos || 0;
    state.dragPos = p.dragPos || 0;
    state.simPos = p.simPos || 0;
    state.trblPos = p.trblPos || 0;
    state.sound = p.sound !== undefined ? p.sound : true;
    $('soundState').textContent = state.sound ? 'On' : 'Off';
  } catch(e){}
}
function resetProgress(){
  if (!confirm('Reset saved progress?')) return;
  localStorage.removeItem('ccnaProgress');
  state.usedQ = new Set();
  state.subnetPos = state.labPos = state.dragPos = state.simPos = state.trblPos = 0;
  saveProgress();
  alert('Progress reset.');
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
  $('quizQ').textContent = `${state.quizPos+1}. ${q.q || q.question || q.q}`;
  const opts = q.o || q.options || q.options;
  const container = $('quizOpts');
  container.innerHTML = '';
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
  // mark used
  state.usedQ.add(q.id || (state.quizPos + 1));
  saveProgress();
  setTimeout(() => { state.quizPos++; loadNextQuizQ(); }, 900);
}
function skipQ(){
  state.quizPos++;
  loadNextQuizQ();
}
function endQuiz(){
  if (state.quizTimer) { clearInterval(state.quizTimer); state.quizTimer = null; state.quizStart = null; }
  alert('Quiz finished. Progress saved.');
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
  $('subnetQ').textContent = `${state.subnetPos+1}. ${item.q || item.question}`;
  $('subnetAns').value = '';
  $('subnetFeedback').classList.add('hidden');
}
function checkSubnet(){
  const val = $('subnetAns').value.trim();
  const item = (DATA.subnetting || [])[state.subnetPos % (DATA.subnetting||[]).length];
  if (!item) return;
  const correct = String(item.a).toLowerCase().trim();
  if (val.toLowerCase() === correct){
    $('subnetFeedback').textContent = `✅ Correct — ${item.e || ''}`;
    $('subnetFeedback').classList.remove('hidden');
    play('sCorrect');
  } else {
    $('subnetFeedback').textContent = `❌ Wrong. Correct: ${item.a}. ${item.e || ''}`;
    $('subnetFeedback').classList.remove('hidden');
    play('sWrong');
  }
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
  $('labScenario').textContent = `${state.labPos+1}. ${lab.name} — ${lab.scenario || ''}`;
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
  // simple string match against solution lines for feedback
  const lab = (DATA.labs || [])[state.labPos % (DATA.labs||[]).length];
  if (!lab) return;
  const sol = (lab.solution || lab.cli || '').toString().split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const terminalText = $('terminal').textContent;
  let ok = true;
  sol.forEach(line => { if (!terminalText.includes(line)) ok = false; });
  if (ok){
    $('labFeedback').textContent = `✅ ${lab.feedback || 'Lab successful!'}`;
    play('sCorrect');
  } else {
    $('labFeedback').textContent = `❌ Not complete. Expected commands:\n${sol.join('\n')}`;
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
  $('dragQ').textContent = item.question || item.title || 'Match items';
  const area = $('dragArea'); area.innerHTML = '';
  // Create draggable keys and target list
  const entries = Object.entries(item.items || {});
  // Shuffle keys
  const keys = entries.map(e=>e[0]).sort(()=>Math.random()-0.5);
  const targets = entries.map(e=>e[1]);
  keys.forEach(k => {
    const d = document.createElement('div');
    d.className = 'drag-item';
    d.draggable = true;
    d.textContent = k;
    d.dataset.key = k;
    d.addEventListener('dragstart', dragStart);
    area.appendChild(d);
  });
  // create target area below
  const targetWrap = document.createElement('div');
  targetWrap.style.marginTop = '12px';
  targets.forEach((t, i) => {
    const box = document.createElement('div');
    box.className = 'drag-item';
    box.dataset.expect = targets[i];
    box.textContent = 'Drop -> ' + t;
    box.addEventListener('dragover', e => e.preventDefault());
    box.addEventListener('drop', dropToTarget);
    targetWrap.appendChild(box);
  });
  area.appendChild(targetWrap);
  $('dragFeedback').classList.add('hidden');
}
function dragStart(e){ e.dataTransfer.setData('text/plain', e.target.dataset.key); }
function dropToTarget(e){ e.preventDefault(); const key = e.dataTransfer.getData('text/plain'); const tgt = e.currentTarget; tgt.textContent = `${tgt.dataset.expect} ← ${key}`; tgt.dataset.got = key; }
function nextDrag(){
  // validate all targets
  const targets = [...$('dragArea').querySelectorAll('[data-expect]')];
  let ok = true;
  targets.forEach(t => {
    const expected = t.dataset.expect;
    const got = t.dataset.got;
    // derive original mapping by looking up in DATA.drag_drop
    const item = DATA.drag_drop[state.dragPos % DATA.drag_drop.length];
    const foundKey = Object.keys(item.items || {}).find(k => item.items[k] === expected);
    if (foundKey !== got) ok = false;
  });
  $('dragFeedback').textContent = ok ? '✅ Correct matches!' : '❌ Some matches are incorrect.';
  $('dragFeedback').classList.remove('hidden');
  if (ok) play('sCorrect'); else play('sWrong');
  state.dragPos++; saveProgress();
  setTimeout(renderDrag, 900);
}

// ----------------- SIMULATIONS
function openSim(){ show('sim'); renderSim(); }
function renderSim(){
  const sims = DATA.simulation || [];
  if (!sims.length) { $('simQ').textContent='No simulations'; return; }
  const s = sims[state.simPos % sims.length];
  $('simQ').textContent = s.scenario || s.title || 'Simulation';
  const tasks = $('simTasks'); tasks.innerHTML = '';
  (s.tasks || []).forEach((t,i) => {
    const div = document.createElement('div'); div.textContent = `${i+1}. ${t}`; tasks.appendChild(div);
  });
  $('simFeedback').classList.add('hidden');
}
function startSim(){ $('simFeedback').textContent='Sim started — follow tasks. (Manual verify)'; $('simFeedback').classList.remove('hidden'); play('sClick'); }
function nextSim(){ state.simPos++; renderSim(); saveProgress(); }

// ----------------- TROUBLESHOOTING
function openTrbl(){ show('trbl'); renderTrbl(); }
function renderTrbl(){
  const arr = DATA.troubleshooting || [];
  if (!arr.length) { $('trblQ').textContent='No scenarios'; return; }
  const s = arr[state.trblPos % arr.length];
  $('trblQ').textContent = s.scenario || s.title;
  const details = $('trblDetails'); details.innerHTML = '';
  if (s.symptoms) {
    const h = document.createElement('div'); h.textContent = 'Symptoms:'; details.appendChild(h);
    const ul = document.createElement('ul'); s.symptoms.forEach(x => { const li = document.createElement('li'); li.textContent = x; ul.appendChild(li); }); details.appendChild(ul);
  }
  if (s.causes) {
    const h = document.createElement('div'); h.textContent = 'Possible Causes:'; details.appendChild(h);
    const ul = document.createElement('ul'); s.causes.forEach(x => { const li = document.createElement('li'); li.textContent = x; ul.appendChild(li); }); details.appendChild(ul);
  }
  if (s.solutions) {
    const h = document.createElement('div'); h.textContent = 'Suggested Solutions:'; details.appendChild(h);
    const ul = document.createElement('ul'); s.solutions.forEach(x => { const li = document.createElement('li'); li.textContent = x; ul.appendChild(li); }); details.appendChild(ul);
  }
}
function nextTrbl(){ state.trblPos++; renderTrbl(); saveProgress(); }

// ----------------- small helpers
function showMessage(msg){ alert(msg); }
