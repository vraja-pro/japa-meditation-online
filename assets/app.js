/**
 * Mantra Meditation Counter
 *
 * Records mic in 5-second chunks via MediaRecorder.
 * Each chunk → WP AJAX proxy → OpenAI Whisper (auto language detection).
 * Whisper transcribes Sanskrit accurately. We do exact word matching.
 *
 * Open the browser console to see raw Whisper output — useful for tuning.
 */
(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════
     CONFIG
  ═══════════════════════════════════════════════════════ */
  const TARGET   = parseInt(document.getElementById('mm-root')?.dataset.target || 108, 10);
  const CHUNK_MS = 5000; // 5-second audio chunks sent to Whisper

  // Exact words Whisper returns for this mantra.
  // Auto-detect language lets Whisper choose Sanskrit/Hindi/Latin freely.
  // Check console logs to see what Whisper actually outputs and add here.
  const RAMA_WORDS = new Set(['राम', 'rama', 'raam', 'rāma', 'ram']);
  const HARE_WORDS = new Set(['हरे', 'हरि', 'hare', 'hari', 'hāre']);

  function isMantraWord(w) {
    const clean = w.toLowerCase().replace(/[।,.!?;:\u0964\u0965]/g, '');
    return RAMA_WORDS.has(clean) || HARE_WORDS.has(clean);
  }

  function isRamaWord(w) { return RAMA_WORDS.has(w.toLowerCase().replace(/[।,.!?;:\u0964\u0965]/g, '')); }
  function isHareWord(w) { return HARE_WORDS.has(w.toLowerCase().replace(/[।,.!?;:\u0964\u0965]/g, '')); }

  /* ═══════════════════════════════════════════════════════
     STATE
  ═══════════════════════════════════════════════════════ */
  let count          = 0;
  let running        = false;
  let startTime      = null;
  let elapsed        = 0;
  let timerInterval  = null;
  let voiceEnabled   = false;
  let mediaRecorder  = null;
  let audioStream    = null;
  let chunkTimer     = null;
  let carryStreak    = 0; // streak carried across chunk boundaries

  /* ═══════════════════════════════════════════════════════
     DOM
  ═══════════════════════════════════════════════════════ */
  const countEl      = document.getElementById('mm-count');
  const timerEl      = document.getElementById('mm-timer');
  const progressCirc = document.getElementById('mm-progress-circle');
  const voiceStatus  = document.getElementById('mm-voice-status');
  const voiceText    = document.getElementById('mm-voice-text');
  const transcriptEl = document.getElementById('mm-transcript');
  const startBtn     = document.getElementById('mm-start-btn');
  const stopBtn      = document.getElementById('mm-stop-btn');
  const resetBtn     = document.getElementById('mm-reset-btn');
  const voiceToggle  = document.getElementById('mm-voice-toggle');
  const manualBtn    = document.getElementById('mm-manual-btn');
  const historyEl    = document.getElementById('mm-history');
  const modal        = document.getElementById('mm-modal');
  const modalCount   = document.getElementById('mm-modal-count');
  const modalTime    = document.getElementById('mm-modal-time');
  const notesEl      = document.getElementById('mm-notes');
  const saveBtn      = document.getElementById('mm-save-btn');
  const discardBtn   = document.getElementById('mm-discard-btn');
  const langBadgeEl  = document.getElementById('mm-lang-badge');

  /* ═══════════════════════════════════════════════════════
     SVG GRADIENT
  ═══════════════════════════════════════════════════════ */
  const svgDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  svgDefs.innerHTML = `
    <linearGradient id="mm-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#d4a843"/>
      <stop offset="100%" stop-color="#e8732a"/>
    </linearGradient>`;
  document.querySelector('.mm-ring').prepend(svgDefs);

  /* ═══════════════════════════════════════════════════════
     TIMER
  ═══════════════════════════════════════════════════════ */
  function startTimer() {
    startTime = Date.now() - elapsed * 1000;
    timerInterval = setInterval(() => {
      elapsed = Math.floor((Date.now() - startTime) / 1000);
      timerEl.textContent = formatTime(elapsed);
    }, 500);
  }
  function stopTimer() { clearInterval(timerInterval); timerInterval = null; }
  function formatTime(s) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  /* ═══════════════════════════════════════════════════════
     COUNT + RING
  ═══════════════════════════════════════════════════════ */
  const CIRC = 2 * Math.PI * 96;

  function setCount(n) {
    count = n;
    countEl.textContent = n;
    progressCirc.style.strokeDashoffset = CIRC * (1 - Math.min(n / TARGET, 1));
  }

  function incrementCount(n) {
    if (!running || n <= 0) return;
    setCount(count + n);
    countEl.classList.remove('mm-bump');
    void countEl.offsetWidth;
    countEl.classList.add('mm-bump');
    setTimeout(() => countEl.classList.remove('mm-bump'), 200);
    spawnRipple();
    setVoiceStatus('detected');
    setTimeout(() => { if (running && voiceEnabled) setVoiceStatus('active'); }, 1500);
  }

  function spawnRipple() {
    const ring = document.querySelector('.mm-ring-wrap');
    const rect = ring.getBoundingClientRect();
    const div  = document.createElement('div');
    div.className = 'mm-ripple';
    const sz = 60;
    div.style.cssText = `width:${sz}px;height:${sz}px;left:${rect.left + rect.width / 2 - sz / 2}px;top:${rect.top + rect.height / 2 - sz / 2}px;`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 700);
  }

  /* ═══════════════════════════════════════════════════════
     WHISPER PIPELINE
  ═══════════════════════════════════════════════════════ */

  async function startVoice() {
    if (!MM_DATA.has_api_key) {
      voiceText.textContent = '⚠ Add OpenAI key in WP Admin → Mantra Meditation';
      voiceToggle.checked = false;
      voiceEnabled = false;
      return;
    }
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (e) {
      voiceText.textContent = '⚠ Microphone access denied';
      voiceToggle.checked = false;
      voiceEnabled = false;
      return;
    }
    carryStreak = 0;
    recordAndTranscribeLoop();
    setVoiceStatus('active');
  }

  function stopVoice() {
    clearTimeout(chunkTimer);
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch (_) {}
    }
    if (audioStream) {
      audioStream.getTracks().forEach(t => t.stop());
      audioStream = null;
    }
    mediaRecorder = null;
    setVoiceStatus('off');
  }

  function getSupportedMimeType() {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
  }

  function recordAndTranscribeLoop() {
    if (!running || !voiceEnabled || !audioStream) return;

    const chunks   = [];
    const mimeType = getSupportedMimeType();

    try {
      mediaRecorder = new MediaRecorder(audioStream, mimeType ? { mimeType } : {});
    } catch (e) {
      console.error('[Mantra] MediaRecorder init failed:', e);
      return;
    }

    mediaRecorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };

    mediaRecorder.onstop = async () => {
      if (!running || !voiceEnabled) return;
      const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
      if (blob.size > 1500) { // skip near-silent chunks
        await transcribeChunk(blob);
      }
      if (running && voiceEnabled) recordAndTranscribeLoop(); // next chunk
    };

    mediaRecorder.start();
    chunkTimer = setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        try { mediaRecorder.stop(); } catch (_) {}
      }
    }, CHUNK_MS);
  }

  async function transcribeChunk(blob) {
    setVoiceStatus('transcribing');
    const fd = new FormData();
    fd.append('action', 'mm_transcribe');
    fd.append('nonce',  MM_DATA.nonce);
    fd.append('audio',  blob, 'audio.webm');

    try {
      const res  = await fetch(MM_DATA.ajax_url, { method: 'POST', body: fd });
      const json = await res.json();

      if (!json.success) {
        console.warn('[Mantra] Whisper error:', json.data?.message);
        showTranscript('⚠ ' + (json.data?.message || 'Recognition error'));
        return;
      }

      const text = (json.data.text || '').trim();
      console.log('[Mantra] Whisper says:', text); // check console to tune word list

      if (text) showTranscript(text);

      const found = countMantrasWithCarry(text);
      if (found > 0) incrementCount(found);

    } catch (e) {
      console.error('[Mantra] Network error:', e);
    }
  }

  /**
   * Count mantras in a transcript, carrying the streak from the previous chunk.
   * This ensures "...Hare Hare" at end of chunk + "Rama Rama..." at start of next
   * still counts correctly.
   */
  function countMantrasWithCarry(text) {
    const words = text.split(/\s+/).filter(Boolean);
    let found  = 0;
    let streak = carryStreak;

    for (const w of words) {
      if (isMantraWord(w)) {
        streak++;
        if (streak === 4) { found++; streak = 0; }
      } else {
        streak = 0;
      }
    }

    carryStreak = streak;
    return found;
  }

  /* ═══════════════════════════════════════════════════════
     TRANSCRIPT DISPLAY
  ═══════════════════════════════════════════════════════ */
  function showTranscript(text) {
    const parts = text.split(/(\s+)/);
    const html  = parts.map(p => {
      const clean = p.toLowerCase().replace(/[।,.!?;:\u0964\u0965]/g, '');
      if (isRamaWord(clean)) {
        return `<mark style="background:rgba(212,168,67,.35);color:#f0c96a;border-radius:3px;padding:0 3px;font-weight:700;">${escHtml(p)}</mark>`;
      }
      if (isHareWord(clean)) {
        return `<mark style="background:rgba(232,115,42,.3);color:#e8732a;border-radius:3px;padding:0 3px;font-weight:700;">${escHtml(p)}</mark>`;
      }
      return escHtml(p);
    }).join('');

    transcriptEl.innerHTML = `"${html}"`;
    clearTimeout(transcriptEl._t);
    transcriptEl._t = setTimeout(() => {
      transcriptEl.innerHTML = '';
      if (running && voiceEnabled) setVoiceStatus('active');
    }, CHUNK_MS + 2000);
  }

  /* ═══════════════════════════════════════════════════════
     STATUS BAR
  ═══════════════════════════════════════════════════════ */
  function setVoiceStatus(state) {
    voiceStatus.classList.remove('mm-active', 'mm-detecting');
    if (langBadgeEl) langBadgeEl.textContent = '';
    switch (state) {
      case 'active':
        voiceStatus.classList.add('mm-active');
        voiceText.textContent = 'Listening…';
        if (langBadgeEl) langBadgeEl.textContent = 'Whisper';
        break;
      case 'transcribing':
        voiceStatus.classList.add('mm-active');
        voiceText.textContent = 'Recognising…';
        if (langBadgeEl) langBadgeEl.textContent = 'Whisper';
        break;
      case 'detected':
        voiceStatus.classList.add('mm-detecting');
        voiceText.textContent = '🙏 Mantra counted!';
        break;
      default:
        voiceText.textContent = 'Voice detection off';
    }
  }

  /* ═══════════════════════════════════════════════════════
     VOICE TOGGLE
  ═══════════════════════════════════════════════════════ */
  voiceToggle.addEventListener('change', () => {
    voiceEnabled = voiceToggle.checked;
    if (running) voiceEnabled ? startVoice() : stopVoice();
  });

  /* ═══════════════════════════════════════════════════════
     SESSION CONTROLS
  ═══════════════════════════════════════════════════════ */
  startBtn.addEventListener('click', () => {
    running = true;
    startBtn.disabled  = true;
    stopBtn.disabled   = false;
    manualBtn.disabled = false;
    startTimer();
    if (voiceEnabled) startVoice();
  });

  stopBtn.addEventListener('click', () => {
    running = false;
    stopTimer();
    stopVoice();
    startBtn.disabled  = false;
    stopBtn.disabled   = true;
    manualBtn.disabled = true;
    modalCount.textContent = count;
    modalTime.textContent  = formatTime(elapsed);
    notesEl.value = '';
    modal.classList.add('mm-open');
    modal.setAttribute('aria-hidden', 'false');
  });

  resetBtn.addEventListener('click', () => {
    if (running) { running = false; stopTimer(); stopVoice(); }
    elapsed = 0; carryStreak = 0;
    timerEl.textContent = '00:00';
    setCount(0);
    transcriptEl.innerHTML = '';
    startBtn.disabled  = false;
    stopBtn.disabled   = true;
    manualBtn.disabled = true;
    setVoiceStatus('off');
  });

  manualBtn.addEventListener('click', () => incrementCount(1));

  /* ═══════════════════════════════════════════════════════
     KEYBOARD  ↑/Space = +1    ↓ = -1
  ═══════════════════════════════════════════════════════ */
  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'ArrowUp' || e.key === ' ') { e.preventDefault(); if (running) incrementCount(1); }
    if (e.key === 'ArrowDown')                { e.preventDefault(); if (running && count > 0) setCount(count - 1); }
  });

  /* ═══════════════════════════════════════════════════════
     MODAL
  ═══════════════════════════════════════════════════════ */
  saveBtn.addEventListener('click',    () => { saveSession(count, elapsed, notesEl.value.trim()); closeModal(); });
  discardBtn.addEventListener('click', closeModal);
  function closeModal() { modal.classList.remove('mm-open'); modal.setAttribute('aria-hidden', 'true'); }

  /* ═══════════════════════════════════════════════════════
     AJAX
  ═══════════════════════════════════════════════════════ */
  function saveSession(mantraCount, durationSec, notes) {
    const fd = new FormData();
    fd.append('action',   'mm_save_session');
    fd.append('nonce',    MM_DATA.nonce);
    fd.append('user_id',  MM_DATA.user_id);
    fd.append('count',    mantraCount);
    fd.append('duration', durationSec);
    fd.append('notes',    notes);
    fetch(MM_DATA.ajax_url, { method: 'POST', body: fd })
      .then(r => r.json()).then(resp => { if (resp.success) loadHistory(); }).catch(console.error);
  }

  function loadHistory() {
    const fd = new FormData();
    fd.append('action',  'mm_get_history');
    fd.append('nonce',   MM_DATA.nonce);
    fd.append('user_id', MM_DATA.user_id);
    fetch(MM_DATA.ajax_url, { method: 'POST', body: fd })
      .then(r => r.json())
      .then(resp => { if (resp.success && resp.data.length) renderHistory(resp.data); })
      .catch(console.error);
  }

  function renderHistory(rows) {
    historyEl.innerHTML = '';
    rows.forEach(row => {
      const m = Math.floor(row.duration_sec / 60), s = row.duration_sec % 60;
      const date = new Date(row.session_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const item = document.createElement('div');
      item.className = 'mm-history-item';
      item.innerHTML = `
        <div>
          <div style="color:var(--mm-text);font-size:.82rem;">ॐ Session</div>
          <div class="mm-history-date">${date}</div>
          ${row.notes ? `<div style="font-size:.72rem;color:var(--mm-text-dim);font-style:italic;">${escHtml(row.notes)}</div>` : ''}
        </div>
        <div style="display:flex;gap:14px;align-items:center;">
          <div class="mm-history-count">${row.mantra_count}</div>
          <div class="mm-history-time">${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}</div>
        </div>`;
      historyEl.appendChild(item);
    });
  }

  function escHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ═══════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════ */
  setCount(0);
  loadHistory();

})();
