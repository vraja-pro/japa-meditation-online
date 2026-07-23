/**
 * Mantra Meditation Counter
 *
 * Uses the browser Web Speech API (Google Speech Recognition) for continuous
 * real-time transcription. Language: en-US. Add mantra vocabulary via the
 * JSGF grammar string below. Open the browser console to see raw output.
 */
(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════
     CONFIG
  ═══════════════════════════════════════════════════════ */
  const TARGET = 108; // one full mala

  const I18N   = window.JMO_I18N || {};

  // Full maha-mantra: Hare Krishna Hare Krishna Krishna Krishna Hare Hare
  //                   Hare Rama    Hare Rama    Rama    Rama    Hare Hare
  // 16 words per complete mantra. Add variants from the console logs.
  const RAMA_WORDS    = new Set(['rama', 'raam', 'rāma', 'ram']);
  const HARE_WORDS    = new Set(['hare', 'hari', 'hāre', 'harry', 'hurray', 'holly']);
  const KRISHNA_WORDS = new Set(['krishna', 'krsna', 'krishn', 'cristina', 'cristine']);

  // Devanagari → Latin transliteration for common mantra words.
  // Devanagari → Latin (used for counting — always English/Latin regardless of UI lang).
  const DEVANAGARI_LATIN = {
    'हरे': 'hare', 'हरि': 'hari', 'हरी': 'hari', 'हर': 'hare', 'हारे': 'hare',
    'राम': 'rama', 'रामा': 'rama',
    'कृष्ण': 'krishna', 'कृष्णा': 'krishna',
    'हरा': 'hara',
  };

  // Devanagari → UI language (used for display, built from I18N word translations).
  const DEVANAGARI_DISPLAY = {
    'हरे': I18N.word_hare    || 'hare',
    'हरि': I18N.word_hare    || 'hari',
    'हरी': I18N.word_hare    || 'hari',
    'हर':  I18N.word_hare    || 'hare',
    'हारे': I18N.word_hare   || 'hare',
    'राम':  I18N.word_rama   || 'rama',
    'रामा': I18N.word_rama   || 'rama',
    'कृष्ण':  I18N.word_krishna || 'krishna',
    'कृष्णा': I18N.word_krishna || 'krishna',
    'हरा': I18N.word_hare    || 'hara',
  };

  function mapDevanagari(text, map) {
    return text.normalize('NFC').split(/(\s+)/).map(token => {
      const cleaned = token.replace(/[।॥.,!?;:""'']/g, '').normalize('NFC');
      if (map[cleaned]) return map[cleaned];
      if (/[ऀ-ॿ]/.test(cleaned)) return '';
      return token;
    }).join('').replace(/\s+/g, ' ').trim();
  }

  // For counting — always Latin.
  function devanagariToLatin(text)   { return mapDevanagari(text, DEVANAGARI_LATIN); }
  // For display — UI language.
  function devanagariToDisplay(text) { return mapDevanagari(text, DEVANAGARI_DISPLAY); }

  function clean(w) { return w.toLowerCase().replace(/[.,!?;:।॥]/g, ''); }

  function isRamaWord(w)    { return RAMA_WORDS.has(clean(w)); }
  function isHareWord(w)    { return HARE_WORDS.has(clean(w)); }
  function isKrishnaWord(w) { return KRISHNA_WORDS.has(clean(w)); }

  // Sorted longest-first so greedy matching picks "krishna" before "krsna" etc.
  const ALL_MANTRA_WORDS = [...RAMA_WORDS, ...HARE_WORDS, ...KRISHNA_WORDS]
    .sort((a, b) => b.length - a.length);

  // Splits a merged token like "harekrishna" into ["hare", "krishna"].
  function extractMantraWords(token) {
    const s = clean(token);
    const found = [];
    let i = 0;
    while (i < s.length) {
      const match = ALL_MANTRA_WORDS.find(mw => s.startsWith(mw, i));
      if (match) { found.push(match); i += match.length; }
      else        { i++; }
    }
    return found;
  }

  /* ═══════════════════════════════════════════════════════
     STATE
  ═══════════════════════════════════════════════════════ */
  let count          = 0;
  let running        = false;
  let startTime      = null;
  let elapsed        = 0;
  let timerInterval  = null;
  let voiceEnabled   = false;
  let recognition    = null;
  let carryStreak    = 0; // streak carried across recognition result boundaries
  let paceMode          = false;
  let paceInterval      = null;
  let inactivityTimeout = null;
  let modalInactivityTimeout = null;
  let endedByInactivity = false;
  let lockTapMode = false;
  let paceSpeed      = 'medium';

  /* ═══════════════════════════════════════════════════════
     DOM
  ═══════════════════════════════════════════════════════ */
  const countEl      = document.getElementById('jmo-count');
  const rootEl       = document.getElementById('jmo-root');
  const timerEl      = document.getElementById('jmo-timer');
  const progressCirc = document.getElementById('jmo-progress-circle');
  const voiceStatus  = document.getElementById('jmo-voice-status');
  const voiceText    = document.getElementById('jmo-voice-text');
  const transcriptEl = document.getElementById('jmo-transcript');
  const stopBtn      = document.getElementById('jmo-stop-btn');
  const resetBtn     = document.getElementById('jmo-reset-btn');
  const voiceToggle  = document.getElementById('jmo-voice-toggle');
  const paceBtnsEl   = document.getElementById('jmo-pace-btns');
  const pacePlayBtn  = document.getElementById('jmo-pace-play');
  const pacePauseBtn = document.getElementById('jmo-pace-pause');
  const manualBtn    = document.getElementById('jmo-manual-btn');
  const lockToggleBtn = document.getElementById('jmo-lock-toggle');
  const historyEl    = document.getElementById('jmo-history');
  const roundsEl     = document.getElementById('jmo-rounds');
  const modal        = document.getElementById('jmo-modal');
  const modalCount   = document.getElementById('jmo-modal-count');
  const modalRounds  = document.getElementById('jmo-modal-rounds');
  const modalTime    = document.getElementById('jmo-modal-time');
  const notesEl      = document.getElementById('jmo-notes');
  const saveBtn      = document.getElementById('jmo-save-btn');
  const dismissBtn   = document.getElementById('jmo-dismiss-btn');
  const discardBtn   = document.getElementById('jmo-discard-btn');
  const langBadgeEl  = document.getElementById('jmo-lang-badge');

  /* ═══════════════════════════════════════════════════════
     SVG GRADIENT
  ═══════════════════════════════════════════════════════ */
  const svgDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  svgDefs.innerHTML = `
    <linearGradient id="jmo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#f5a254"/>
      <stop offset="100%" stop-color="#c45e0a"/>
    </linearGradient>`;
  document.querySelector('.jmo-ring').prepend(svgDefs);

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
    const mantrasInRound = n % TARGET;
    countEl.textContent = mantrasInRound;
    roundsEl.textContent = Math.floor(n / TARGET);
    progressCirc.style.strokeDashoffset = CIRC * (1 - mantrasInRound / TARGET);
  }

  function resetInactivity() {
    clearTimeout(inactivityTimeout);
    inactivityTimeout = setTimeout(() => endSession({ reason: 'inactivity' }), 60 * 1000);
  }

  function clearInactivity() {
    clearTimeout(inactivityTimeout);
    inactivityTimeout = null;
  }

  function resetModalInactivityAutoSave() {
    if (!endedByInactivity || !modal.classList.contains('jmo-open')) return;
    clearTimeout(modalInactivityTimeout);
    modalInactivityTimeout = setTimeout(() => {
      saveSession(count, elapsed, I18N.auto_saved_inactivity || 'Auto-saved after inactivity');
      closeModal();
      doReset();
    }, 60 * 1000);
  }

  function clearModalInactivityAutoSave() {
    clearTimeout(modalInactivityTimeout);
    modalInactivityTimeout = null;
  }

  function incrementCount(n) {
    if (!running || n <= 0) return;
    setCount(count + n);
    countEl.classList.remove('jmo-bump');
    void countEl.offsetWidth;
    countEl.classList.add('jmo-bump');
    setTimeout(() => countEl.classList.remove('jmo-bump'), 200);
    spawnRipple();
    resetInactivity();
    if (voiceEnabled) {
      setVoiceStatus('detected');
      setTimeout(() => { if (running && voiceEnabled) setVoiceStatus('active'); }, 1500);
    }
  }

  function setLockTapMode(enabled) {
    lockTapMode = enabled;
    if (rootEl) rootEl.classList.toggle('jmo-lock-tap-on', enabled);
    if (lockToggleBtn) {
      lockToggleBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      lockToggleBtn.classList.toggle('jmo-lock-btn-on', enabled);
      lockToggleBtn.textContent = enabled
        ? (I18N.unlock_tap || 'Unlock Tap')
        : (I18N.lock_tap || 'Lock Tap');
    }
  }

  function spawnRipple() {
    const ring = document.querySelector('.jmo-ring-wrap');
    const rect = ring.getBoundingClientRect();
    const div  = document.createElement('div');
    div.className = 'jmo-ripple';
    const sz = 60;
    div.style.cssText = `width:${sz}px;height:${sz}px;left:${rect.left + rect.width / 2 - sz / 2}px;top:${rect.top + rect.height / 2 - sz / 2}px;`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 700);
  }

  /* ═══════════════════════════════════════════════════════
     GOOGLE SPEECH API PIPELINE
  ═══════════════════════════════════════════════════════ */

  // Add mantra vocabulary hints. Use JSGF format.
  // The user will extend this list with additional words.
  const MANTRA_GRAMMAR = '#JSGF V1.0; grammar mantra; public <mantra> = hare | krishna | krsna | rama | hari | ram | hara;';

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      voiceText.textContent = I18N.no_support || '⚠ Voice recognition not supported in this browser';
      voiceToggle.checked = false;
      voiceEnabled = false;
      return;
    }

    recognition = new SR();
    recognition.lang            = 'hi-IN';
    recognition.continuous      = true;
    recognition.interimResults  = false;
    recognition.maxAlternatives = 1;

    const SGL = window.SpeechGrammarList || window.webkitSpeechGrammarList;
    if (SGL) {
      const list = new SGL();
      list.addFromString(MANTRA_GRAMMAR, 1);
      recognition.grammars = list;
    }

    recognition.onstart = () => setVoiceStatus('active');

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const raw  = event.results[i][0].transcript.trim();
          console.log('[Mantra] RAW:', raw);
          console.log('[Mantra] Display:', devanagariToDisplay(raw));
          const text = devanagariToLatin(raw);
          const found = countMantrasWithCarry(text);
          updateMantraHighlight();
          if (found > 0) incrementCount(found);
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('[Mantra] Speech error:', event.error);
      if (event.error === 'not-allowed') {
        voiceText.textContent = I18N.mic_denied || '⚠ Microphone access denied';
        voiceToggle.checked = false;
        voiceEnabled = false;
      }
    };

    // Auto-restart after silence or network interruption
    recognition.onend = () => {
      if (running && voiceEnabled) {
        try { recognition.start(); } catch (_) {}
      }
    };

    carryStreak = 0;
    try { recognition.start(); } catch (e) { console.error('[Mantra] Recognition start failed:', e); }
  }

  function stopVoice() {
    if (recognition) {
      recognition.onend = null; // prevent auto-restart
      try { recognition.stop(); } catch (_) {}
      recognition = null;
    }
    setVoiceStatus('off');
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

    for (const t of words) {
      let n = extractMantraWords(t).length;
      while (n-- > 0) {
        streak++;
        if (streak === 16) { found++; streak = 0; } // full maha-mantra = 16 words
      }
      // non-mantra tokens yield no words — noise and mishearings are ignored
    }

    carryStreak = streak;
    return found;
  }

  /* ═══════════════════════════════════════════════════════
     MANTRA DISPLAY
  ═══════════════════════════════════════════════════════ */
  const W_HARE    = I18N.word_hare    || 'Hare';
  const W_KRISHNA = I18N.word_krishna || 'Krishna';
  const W_RAMA    = I18N.word_rama    || 'Rama';

  const MANTRA_WORDS = [
    W_HARE, W_KRISHNA, W_HARE, W_KRISHNA, W_KRISHNA, W_KRISHNA, W_HARE, W_HARE,
    W_HARE, W_RAMA,    W_HARE, W_RAMA,    W_RAMA,    W_RAMA,    W_HARE, W_HARE,
  ];

  const MANTRA_TYPES = [
    'hare', 'krishna', 'hare', 'krishna', 'krishna', 'krishna', 'hare', 'hare',
    'hare', 'rama',    'hare', 'rama',    'rama',    'rama',    'hare', 'hare',
  ];

  function initTranscript() {
    transcriptEl.innerHTML = MANTRA_WORDS.map((word, i) => {
      const prefix = i > 0 && i % 4 === 0 ? '<br>' : (i > 0 ? ' ' : '');
      return `${prefix}<span class="jmo-mantra-word jmo-word-${MANTRA_TYPES[i]}">${word}</span>`;
    }).join('');
    updateMantraHighlight();
  }

  function updateMantraHighlight() {
    transcriptEl.classList.toggle('jmo-mode-active', paceMode);
    transcriptEl.querySelectorAll('.jmo-mantra-word').forEach((span, i) => {
      span.classList.toggle('jmo-word-lit',  i < carryStreak);
      span.classList.toggle('jmo-word-next', paceMode && running && i === carryStreak);
    });
  }

  /* ═══════════════════════════════════════════════════════
     STATUS BAR
  ═══════════════════════════════════════════════════════ */
  function setVoiceStatus(state) {
    voiceStatus.classList.remove('jmo-active', 'jmo-detecting');
    if (langBadgeEl) langBadgeEl.textContent = '';
    switch (state) {
      case 'active':
        voiceStatus.classList.add('jmo-active');
        voiceText.textContent = I18N.listening   || 'Listening…';
        if (langBadgeEl) langBadgeEl.textContent = 'Google';
        break;
      case 'transcribing':
        voiceStatus.classList.add('jmo-active');
        voiceText.textContent = I18N.recognising || 'Recognising…';
        if (langBadgeEl) langBadgeEl.textContent = 'Google';
        break;
      case 'detected':
        voiceStatus.classList.add('jmo-detecting');
        voiceText.textContent = I18N.detected    || 'Mantra counted!';
        break;
      default:
        voiceText.textContent = I18N.voice_off_status || 'Voice detection off';
    }
  }

  /* ═══════════════════════════════════════════════════════
     PACE MODE
  ═══════════════════════════════════════════════════════ */
  const PACE_MS = { slow: 600, medium: 500, fast: 300 };

  function startPace() {
    clearInterval(paceInterval);
    paceInterval = setInterval(() => {
      if (!running) return;
      carryStreak++;
      if (carryStreak === 16) { carryStreak = 0; incrementCount(1); }
      updateMantraHighlight();
    }, PACE_MS[paceSpeed]);
  }

  function stopPace() {
    clearInterval(paceInterval);
    paceInterval = null;
  }

  function setPaceRunning(active) {
    paceMode = active;
    pacePlayBtn.disabled  =  active;
    pacePauseBtn.disabled = !active;
    if (active) {
      voiceToggle.checked = false;
      voiceEnabled = false;
      stopVoice();
      startSession();
      startPace();
    } else {
      stopPace();
    }
    updateMantraHighlight();
  }

  pacePlayBtn.addEventListener('click',  () => setPaceRunning(true));
  pacePauseBtn.addEventListener('click', () => setPaceRunning(false));

  paceBtnsEl.querySelectorAll('.jmo-pace-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      paceSpeed = btn.dataset.pace;
      paceBtnsEl.querySelectorAll('.jmo-pace-btn').forEach(b => b.classList.remove('jmo-pace-selected'));
      btn.classList.add('jmo-pace-selected');
      if (paceMode && running) startPace();
    });
  });

  /* ═══════════════════════════════════════════════════════
     VOICE TOGGLE
  ═══════════════════════════════════════════════════════ */
  voiceToggle.addEventListener('change', () => {
    voiceEnabled = voiceToggle.checked;
    if (voiceEnabled) {
      paceMode = false;
      pacePlayBtn.disabled  = false;
      pacePauseBtn.disabled = true;
      stopPace();
      startSession();
      startVoice();
    } else {
      stopVoice();
    }
  });

  /* ═══════════════════════════════════════════════════════
     SESSION CONTROLS
  ═══════════════════════════════════════════════════════ */
  function startSession() {
    if (running) return;
    running = true;

    stopBtn.disabled   = false;
    startTimer();
    resetInactivity();
    if (voiceEnabled) startVoice();
    if (paceMode)     startPace();
  }

  function endSession(options = {}) {
    const reason = options.reason || 'manual';
    if (!running) return;
    endedByInactivity = reason === 'inactivity';
    running = false;
    stopTimer();
    stopVoice();
    stopPace();
    clearInactivity();

    stopBtn.disabled   = true;
    modalCount.textContent  = count;
    modalRounds.textContent = Math.floor(count / TARGET);
    modalTime.textContent   = formatTime(elapsed);
    notesEl.value = '';
    modal.classList.add('jmo-open');
    modal.setAttribute('aria-hidden', 'false');
    resetModalInactivityAutoSave();
  }

  stopBtn.addEventListener('click', () => endSession({ reason: 'manual' }));

  resetBtn.addEventListener('click', () => {
    if (running) { running = false; stopTimer(); stopVoice(); stopPace(); clearInactivity(); }
    stopBtn.disabled = true;
    doReset();
  });

  manualBtn.addEventListener('click', () => { startSession(); incrementCount(1); });

  if (lockToggleBtn) {
    lockToggleBtn.addEventListener('click', () => {
      setLockTapMode(!lockTapMode);
    });
  }

  if (rootEl) {
    rootEl.addEventListener('click', event => {
      if (!lockTapMode) return;
      if (modal.classList.contains('jmo-open')) return;
      if (lockToggleBtn && lockToggleBtn.contains(event.target)) return;
      if (manualBtn && manualBtn.contains(event.target)) return;
      startSession();
      incrementCount(1);
    });
  }

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
  saveBtn.addEventListener('click',    () => { saveSession(count, elapsed, notesEl.value.trim()); closeModal(); doReset(); });
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      closeModal();
      if (endedByInactivity) {
        endedByInactivity = false;
        startSession();
      }
    });
  }
  discardBtn.addEventListener('click', () => { closeModal(); doReset(); });
  function closeModal() {
    modal.classList.remove('jmo-open');
    modal.setAttribute('aria-hidden', 'true');
    clearModalInactivityAutoSave();
  }

  ['click', 'input', 'keydown', 'mousemove', 'touchstart'].forEach(eventName => {
    modal.addEventListener(eventName, resetModalInactivityAutoSave);
  });

  function doReset() {
    elapsed = 0; carryStreak = 0;
    endedByInactivity = false;
    clearModalInactivityAutoSave();
    timerEl.textContent = '00:00';
    setCount(0);
    initTranscript();
    setVoiceStatus('off');
  }

  /* ═══════════════════════════════════════════════════════
     AJAX
  ═══════════════════════════════════════════════════════ */
  const STORAGE_KEY = 'mm_sessions';

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  function unexpiredSessions() {
    const today    = todayStr();
    const sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      .filter(s => { const d = new Date(s.session_date); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === today; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    return sessions;
  }

  function saveSession(mantraCount, durationSec, notes) {
    const sessions = unexpiredSessions();
    sessions.unshift({
      session_date: new Date().toISOString(),
      duration_sec: durationSec,
      mantra_count: mantraCount,
      rounds:       Math.floor(mantraCount / TARGET),
      notes:        notes,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 10)));
    loadHistory();
  }

  function loadHistory() {
    const sessions = unexpiredSessions();
    if (sessions.length) renderHistory(sessions);
  }

  function renderHistory(rows) {
    historyEl.innerHTML = '';

    rows.forEach(row => {
      const m = Math.floor(row.duration_sec / 60), s = row.duration_sec % 60;
      const d = new Date(row.session_date);
      const date = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
      const item = document.createElement('div');
      item.className = 'jmo-history-item';
      item.innerHTML = `
        <div>
          <div style="color:var(--jmo-text);font-size:.82rem;">${I18N.session_label || 'Session'}</div>
          <div class="jmo-history-date">${date}</div>
          ${row.notes ? `<div style="font-size:.72rem;color:var(--jmo-text-dim);font-style:italic;">${escHtml(row.notes)}</div>` : ''}
        </div>
        <div style="display:flex;gap:16px;align-items:flex-end;">
          <div style="text-align:center;min-width:36px;">
            <div class="jmo-history-count">${row.mantra_count}</div>
            <div class="jmo-history-stat-label">${I18N.mantras_label || 'mantras'}</div>
          </div>
          <div style="text-align:center;min-width:36px;">
            <div class="jmo-history-count">${row.rounds ?? Math.floor(row.mantra_count / 108)}</div>
            <div class="jmo-history-stat-label">${I18N.stat_rounds || 'rounds'}</div>
          </div>
          <div style="text-align:center;min-width:44px;">
            <div class="jmo-history-time">${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}</div>
            <div class="jmo-history-stat-label">${I18N.stat_duration || 'duration'}</div>
          </div>
        </div>`;
      historyEl.appendChild(item);
    });

    // Totals row
    const totalMantras  = rows.reduce((a, r) => a + r.mantra_count, 0);
    const totalRounds   = rows.reduce((a, r) => a + (r.rounds ?? Math.floor(r.mantra_count / 108)), 0);
    const totalSec      = rows.reduce((a, r) => a + r.duration_sec, 0);
    const tm = Math.floor(totalSec / 60), ts = totalSec % 60;

    const totals = document.createElement('div');
    totals.className = 'jmo-history-totals';
    totals.innerHTML = `
      <span class="jmo-history-totals-label">${I18N.total || 'Total'}</span>
      <div style="display:flex;gap:16px;align-items:flex-end;">
        <div style="text-align:center;min-width:36px;">
          <div class="jmo-history-count">${totalMantras}</div>
          <div class="jmo-history-stat-label">${I18N.mantras_label || 'mantras'}</div>
        </div>
        <div style="text-align:center;min-width:36px;">
          <div class="jmo-history-count">${totalRounds}</div>
          <div class="jmo-history-stat-label">${I18N.stat_rounds || 'rounds'}</div>
        </div>
        <div style="text-align:center;min-width:44px;">
          <div class="jmo-history-time">${String(tm).padStart(2,'0')}:${String(ts).padStart(2,'0')}</div>
          <div class="jmo-history-stat-label">${I18N.stat_duration || 'duration'}</div>
        </div>
      </div>`;
    historyEl.appendChild(totals);
  }

  function escHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ═══════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════ */
  setCount(0);
  initTranscript();
  loadHistory();

})();
