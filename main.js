/* ============================================================
   SPLITBILL — main.js
   Tear animation + Sound Engine + Split Calculator
============================================================ */

/* ── TEAR ANIMATION & SOUND ENGINE ── */
const tearSection = document.getElementById('tear-section');
  const receiptTop = document.getElementById('receiptTop');
  const receiptBottom = document.getElementById('receiptBottom');
  const receiptGap = document.getElementById('receiptGap');
  const ctaWrapper = document.getElementById('ctaWrapper');
  const tearLineWrap = document.getElementById('tearLineWrap');
  const tearCrack = document.getElementById('tearCrack');
  const tearFibres = document.getElementById('tearFibres');
  const perfLine = document.getElementById('perfLine');
  const scissorsIcon = document.getElementById('scissorsIcon');

  let currentTear = 0;
  let targetTear = 0;

  /* Position tear line overlay at the junction of top/bottom receipt halves */
  function positionTearLine() {
    const receiptContainer = receiptTop.closest('.receipt-container');
    const containerRect = receiptContainer.getBoundingClientRect();
    const wrapperRect = document.querySelector('.sticky-wrapper').getBoundingClientRect();
    // Offset from wrapper center to junction point
    const junctionFromContainerTop = receiptTop.offsetHeight;
    const containerFromWrapperTop = containerRect.top - wrapperRect.top;
    const junctionY = containerFromWrapperTop + junctionFromContainerTop;
    tearLineWrap.style.top = `${junctionY - 12}px`;
    tearLineWrap.style.marginTop = '0';
  }
  // Run after layout
  requestAnimationFrame(positionTearLine);
  window.addEventListener('resize', positionTearLine);

  /* ── TEAR SOUND ENGINE (Web Audio API — no files needed) ── */
  let audioCtx = null;
  let tearNoiseNode = null;
  let tearGainNode = null;
  let tearFilterNode = null;
  let lastTear = 0;
  let soundInitialized = false;

  function initAudio() {
    if (soundInitialized) return;
    soundInitialized = true;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // White noise buffer (1 second, looped)
    const bufferSize = audioCtx.sampleRate * 1;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    tearNoiseNode = audioCtx.createBufferSource();
    tearNoiseNode.buffer = noiseBuffer;
    tearNoiseNode.loop = true;

    // Bandpass filter — paper tear sits ~1.5kHz–4kHz
    tearFilterNode = audioCtx.createBiquadFilter();
    tearFilterNode.type = 'bandpass';
    tearFilterNode.frequency.value = 2200;
    tearFilterNode.Q.value = 0.6;

    // A second filter for a crinkle texture
    const crinkleFilter = audioCtx.createBiquadFilter();
    crinkleFilter.type = 'peaking';
    crinkleFilter.frequency.value = 800;
    crinkleFilter.gain.value = 8;
    crinkleFilter.Q.value = 1.2;

    // Gain node — volume driven by tear speed
    tearGainNode = audioCtx.createGain();
    tearGainNode.gain.value = 0;

    // Subtle distortion for paper crunch
    const waveshaper = audioCtx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      curve[i] = (Math.PI + 80) * x / (Math.PI + 80 * Math.abs(x));
    }
    waveshaper.curve = curve;
    waveshaper.oversample = '2x';

    // Chain: noise → bandpass → crinkle → distort → gain → output
    tearNoiseNode.connect(tearFilterNode);
    tearFilterNode.connect(crinkleFilter);
    crinkleFilter.connect(waveshaper);
    waveshaper.connect(tearGainNode);
    tearGainNode.connect(audioCtx.destination);

    tearNoiseNode.start();
  }

  function updateTearSound(t) {
    if (!audioCtx) return;
    const speed = Math.abs(t - lastTear);  // how fast user is scrolling
    lastTear = t;

    const isTearing = t > 0.02 && t < 0.98;
    const vol = isTearing ? Math.min(speed * 80, 0.55) : 0;

    // Ramp gain smoothly so it doesn't click
    tearGainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    tearGainNode.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.04);

    // Pitch shifts slightly as tear progresses (paper tension releases)
    tearFilterNode.frequency.setTargetAtTime(
      1800 + t * 900 + speed * 2000,
      audioCtx.currentTime, 0.05
    );
  }

  // Init audio on first scroll interaction
  window.addEventListener('scroll', () => {
    if (!soundInitialized) initAudio();
  }, { once: true });

  /* ── ANIMATION LOOP ── */
  function animate() {
    currentTear += (targetTear - currentTear) * 0.08;
    updateTearSound(currentTear);
    applyTear(currentTear);
    requestAnimationFrame(animate);
  }

  function applyTear(t) {
    receiptTop.style.transform    = `translateY(${-t * 140}px) rotate(${-t * 5}deg)`;
    receiptBottom.style.transform = `translateY(${t * 140}px) rotate(${t * 5}deg)`;
    receiptGap.style.height = `${t * 100}px`;
    ctaWrapper.classList.toggle('visible', t > 0.5);

    /* ── Tear line animation ── */
    // 1. Perforation line fades out as crack appears
    perfLine.style.opacity = Math.max(0, 1 - t * 4);
    scissorsIcon.style.opacity = Math.max(0, 0.45 - t * 2);

    // 2. Crack draws from left to right (dashoffset 340→0)
    const crackProgress = Math.min(1, t * 2.5);    // fully drawn by t=0.4
    const dashOffset = 340 * (1 - crackProgress);
    tearCrack.style.strokeDashoffset = dashOffset;
    tearCrack.style.opacity = crackProgress > 0.01 ? 1 : 0;

    // 3. Crack color shifts: white → warm orange-red as it deepens
    const r = Math.round(255);
    const g = Math.round(255 - crackProgress * 200);
    const b = Math.round(255 - crackProgress * 255);
    tearCrack.style.stroke = `rgb(${r},${g},${b})`;
    tearCrack.style.strokeWidth = 1.5 + crackProgress * 1.2;

    // 4. Fibres appear at peak tear (t 0.2→0.6), then fade as halves pull apart
    const fibreOpacity = t < 0.15 ? 0
                        : t < 0.45 ? (t - 0.15) / 0.3
                        : t < 0.7  ? 1 - (t - 0.45) / 0.25
                        : 0;
    tearFibres.style.opacity = fibreOpacity;

    // 5. Move tear line wrap with the split point (stays between separating halves)
    const splitY = -t * 0;   // the wrap is already at junction; let it drift naturally
    tearLineWrap.style.transform = `translateX(-50%)`;
    tearLineWrap.style.opacity = t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15;
  }

  function onScroll() {
    const rect = tearSection.getBoundingClientRect();
    const totalScroll = tearSection.offsetHeight - window.innerHeight;
    targetTear = Math.max(0, Math.min(1, -rect.top / totalScroll));
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  animate();

/* ── SPLIT CALCULATOR APP ── */
/* ══ SPLIT APP STATE ══ */
const COLORS = ['#ff3b2f','#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316'];
let items   = [];
let people  = [];
let splitMode = 'even';
let customWeights = {};
let currentStep = 1;

/* ── Open / Close ── */
function openSplitApp() {
  document.getElementById('splitApp').classList.add('open');
  document.body.style.overflow = 'hidden';
  if (items.length === 0) initDefaults();
  goStep(1);
}
function closeSplitApp() {
  document.getElementById('splitApp').classList.remove('open');
  document.body.style.overflow = '';
}

function initDefaults() {
  items = [
    { id: uid(), name: 'Margherita Pizza ×2', price: 28 },
    { id: uid(), name: 'Truffle Pasta',        price: 22 },
    { id: uid(), name: 'Caesar Salad',         price: 14 },
    { id: uid(), name: 'Craft Beer ×4',        price: 32 },
    { id: uid(), name: 'Sparkling Water',      price: 6  },
    { id: uid(), name: 'Tiramisu',             price: 11 },
  ];
  people = [
    { id: uid(), name: 'Alex' },
    { id: uid(), name: 'Max'  },
    { id: uid(), name: 'Sam'  },
    { id: uid(), name: 'Jade' },
  ];
  renderItems();
  renderPeople();
  recalc();
}

function uid() { return Math.random().toString(36).slice(2,9); }

/* ── Steps ── */
function goStep(n) {
  if (n === 3) buildResults();
  document.querySelectorAll('.sa-screen').forEach(s => s.classList.remove('active'));
  document.getElementById('step' + n).classList.add('active');
  document.getElementById('stepBadge').textContent = `Step ${n} / 3`;
  document.getElementById('progressFill').style.width = `${n * 33.33}%`;
  currentStep = n;
}

/* ── Items ── */
function renderItems() {
  const list = document.getElementById('itemsList');
  list.innerHTML = items.map((it,i) => `
    <div class="sa-item-row" id="irow_${it.id}">
      <input class="sa-input" placeholder="Item name" value="${esc(it.name)}"
        oninput="updateItem('${it.id}','name',this.value)">
      <div class="sa-price-wrap">
        <input class="sa-input" type="number" placeholder="0.00" value="${it.price || ''}" min="0" step="0.01"
          oninput="updateItem('${it.id}','price',parseFloat(this.value)||0); recalc()">
      </div>
      <button class="sa-del-btn" onclick="removeItem('${it.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`).join('');
  recalc();
}
function addItem() {
  items.push({ id: uid(), name: '', price: 0 });
  renderItems();
  // focus new name input
  setTimeout(() => {
    const inputs = document.querySelectorAll('#itemsList .sa-item-row:last-child input');
    if (inputs[0]) inputs[0].focus();
  }, 50);
}
function removeItem(id) { items = items.filter(i => i.id !== id); renderItems(); }
function updateItem(id, key, val) { const i = items.find(x => x.id === id); if(i) i[key] = val; }

/* ── Recalc totals ── */
function recalc() {
  const sub  = items.reduce((s,i) => s + (parseFloat(i.price)||0), 0);
  const tax  = sub * (parseFloat(document.getElementById('taxPct')?.value||0)/100);
  const tip  = sub * (parseFloat(document.getElementById('tipPct')?.value||0)/100);
  const grand = sub + tax + tip;
  const el = document.getElementById('grandTotal');
  if (el) el.textContent = '$' + grand.toFixed(2);
}

/* ── People ── */
function renderPeople() {
  const list = document.getElementById('peopleList');
  list.innerHTML = people.map((p,i) => `
    <div class="sa-person-row" id="prow_${p.id}">
      <div class="sa-person-avatar" style="background:${COLORS[i%COLORS.length]}">
        ${(p.name||'?')[0].toUpperCase()}
      </div>
      <input class="sa-input" placeholder="Name" value="${esc(p.name)}"
        oninput="updatePerson('${p.id}',this.value); renderCustomWeights()">
      <button class="sa-del-btn" onclick="removePerson('${p.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`).join('');
  renderCustomWeights();
}
function addPerson() {
  people.push({ id: uid(), name: '' });
  renderPeople();
  setTimeout(() => {
    const rows = document.querySelectorAll('#peopleList .sa-person-row');
    const last = rows[rows.length-1];
    if(last) last.querySelector('input')?.focus();
  }, 50);
}
function removePerson(id) {
  people = people.filter(p => p.id !== id);
  delete customWeights[id];
  renderPeople();
}
function updatePerson(id, val) {
  const p = people.find(x => x.id === id);
  if(p) { p.name = val; }
  // refresh avatar letter
  const row = document.getElementById('prow_' + id);
  if(row) row.querySelector('.sa-person-avatar').textContent = (val||'?')[0].toUpperCase();
}

/* ── Split mode ── */
function setSplitMode(mode) {
  splitMode = mode;
  document.getElementById('modeEven').classList.toggle('active', mode==='even');
  document.getElementById('modeCustom').classList.toggle('active', mode==='custom');
  const cw = document.getElementById('customWeights');
  cw.style.display = mode === 'custom' ? 'flex' : 'none';
  if (mode === 'custom') renderCustomWeights();
}
function renderCustomWeights() {
  const cw = document.getElementById('customWeights');
  if (!cw) return;
  cw.innerHTML = `<div style="font-size:10px;letter-spacing:0.15em;color:rgba(245,240,232,.4);text-transform:uppercase;padding:4px 0">Custom split percentages</div>` +
    people.map((p,i) => `
    <div class="sa-weight-row">
      <div class="sa-person-avatar" style="background:${COLORS[i%COLORS.length]};width:36px;height:36px;font-size:15px">
        ${(p.name||'?')[0].toUpperCase()}
      </div>
      <span class="sa-weight-name">${esc(p.name||'Person')}</span>
      <div class="sa-input-group">
        <input class="sa-input" type="number" min="0" max="100" step="1"
          value="${customWeights[p.id]||Math.round(100/people.length)}"
          oninput="customWeights['${p.id}']=parseFloat(this.value)||0" style="padding-right:26px">
        <span>%</span>
      </div>
    </div>`).join('');
}

/* ── Results ── */
function buildResults() {
  const sub   = items.reduce((s,i) => s + (parseFloat(i.price)||0), 0);
  const taxPct = parseFloat(document.getElementById('taxPct')?.value||0)/100;
  const tipPct = parseFloat(document.getElementById('tipPct')?.value||0)/100;
  const grand  = sub * (1 + taxPct + tipPct);
  const n = people.length || 1;

  // Compute each person's share
  let shares = [];
  if (splitMode === 'even') {
    shares = people.map(() => grand / n);
  } else {
    const totalW = people.reduce((s,p) => s + (parseFloat(customWeights[p.id])||0), 0) || 100;
    shares = people.map(p => grand * ((parseFloat(customWeights[p.id])||0) / totalW));
  }

  // Result cards
  const cards = document.getElementById('resultsCards');
  cards.innerHTML = people.map((p,i) => `
    <div class="sa-result-card" style="background:${COLORS[i%COLORS.length]}22; border: 1px solid ${COLORS[i%COLORS.length]}44;" data-delay="${i*80}">
      <div class="sa-rc-left">
        <div class="sa-rc-avatar" style="background:${COLORS[i%COLORS.length]}">${(p.name||'?')[0].toUpperCase()}</div>
        <div>
          <div class="sa-rc-name">${esc(p.name||'Person')}</div>
          <div class="sa-rc-pct">${splitMode==='even'?'Even split':(((parseFloat(customWeights[p.id])||0)).toFixed(0)+'% share')}</div>
        </div>
      </div>
      <div class="sa-rc-amount" style="color:${COLORS[i%COLORS.length]}">$${shares[i].toFixed(2)}</div>
    </div>`).join('');

  // Stagger card animations
  cards.querySelectorAll('.sa-result-card').forEach((c,i) => {
    c.style.animationDelay = `${i*80}ms`;
  });

  // Summary receipt
  const sr = document.getElementById('summaryReceipt');
  sr.innerHTML = `
    <div class="sa-sr-title">BILL SUMMARY</div>
    ${items.map(it=>`<div class="sa-sr-row"><span>${esc(it.name||'Item')}</span><span>$${(parseFloat(it.price)||0).toFixed(2)}</span></div>`).join('')}
    <hr class="sa-sr-divider">
    <div class="sa-sr-row"><span>Subtotal</span><span>$${sub.toFixed(2)}</span></div>
    <div class="sa-sr-row"><span>Tax (${(taxPct*100).toFixed(1)}%)</span><span>$${(sub*taxPct).toFixed(2)}</span></div>
    <div class="sa-sr-row"><span>Tip (${(tipPct*100).toFixed(0)}%)</span><span>$${(sub*tipPct).toFixed(2)}</span></div>
    <hr class="sa-sr-divider">
    <div class="sa-sr-row bold"><span>GRAND TOTAL</span><span>$${grand.toFixed(2)}</span></div>
    <hr class="sa-sr-divider">
    ${people.map((p,i)=>`<div class="sa-sr-row bold" style="color:${COLORS[i%COLORS.length]}"><span>${esc(p.name||'Person')}</span><span>$${shares[i].toFixed(2)}</span></div>`).join('')}
  `;
}

function copyResults() {
  const sub   = items.reduce((s,i) => s + (parseFloat(i.price)||0), 0);
  const taxPct = parseFloat(document.getElementById('taxPct')?.value||0)/100;
  const tipPct = parseFloat(document.getElementById('tipPct')?.value||0)/100;
  const grand  = sub * (1 + taxPct + tipPct);
  const n = people.length || 1;
  let shares = splitMode === 'even'
    ? people.map(() => grand / n)
    : (() => { const tw = people.reduce((s,p)=>s+(parseFloat(customWeights[p.id])||0),0)||100; return people.map(p=>grand*((parseFloat(customWeights[p.id])||0)/tw)); })();

  const text = `🧾 SPLITBILL RESULTS\nTotal: $${grand.toFixed(2)}\n\n` +
    people.map((p,i) => `${p.name||'Person'}: $${shares[i].toFixed(2)}`).join('\n');
  navigator.clipboard.writeText(text).catch(()=>{});
  const t = document.getElementById('copyToast');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function restartApp() {
  items = []; people = []; customWeights = {}; splitMode = 'even';
  document.getElementById('modeEven').classList.add('active');
  document.getElementById('modeCustom').classList.remove('active');
  document.getElementById('customWeights').style.display = 'none';
  initDefaults();
  goStep(1);
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}