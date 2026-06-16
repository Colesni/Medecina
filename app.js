/**
 * BioChemQuiz — app.js
 * Pure vanilla JS, no frameworks, no backend.
 * Runs completely offline in any modern browser.
 */

// ═══════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════

const State = {
  data: null,              // loaded from data.json
  currentCardId: null,     // which card is active
  shuffledQuestions: [],   // Fisher-Yates shuffled
  questionIndex: 0,        // current question pointer
  score: { total: 0, correct: 0 },
  diffScore: {
    easy:   { total: 0, correct: 0 },
    medium: { total: 0, correct: 0 },
    hard:   { total: 0, correct: 0 },
  },
  userAnswers: [],         // [{questionId, chosen, correct}]
  hintShown: false,

  // Persistent via localStorage
  progress: {},            // { cardId: { lastScore, played } }
};

// ═══════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════

/** Fisher-Yates shuffle — returns new shuffled array */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pct(num, den) {
  if (!den) return 0;
  return Math.round((num / den) * 100);
}

function gradeEmoji(p) {
  if (p >= 90) return '🏆';
  if (p >= 75) return '🥇';
  if (p >= 60) return '✅';
  if (p >= 40) return '📚';
  return '💪';
}

/** Load from localStorage or return default */
function loadProgress() {
  try {
    const raw = localStorage.getItem('biochemquiz_progress');
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveProgress() {
  try {
    localStorage.setItem('biochemquiz_progress', JSON.stringify(State.progress));
  } catch {}
}

// ═══════════════════════════════════════════════════
// SCREENS
// ═══════════════════════════════════════════════════

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('active');
    window.scrollTo(0, 0);
  }
}

// ═══════════════════════════════════════════════════
// HOME SCREEN
// ═══════════════════════════════════════════════════

function renderHome() {
  renderHeaderStats();
  renderCards();
  showScreen('screen-home');
}

function renderHeaderStats() {
  const allCards = State.data.cards;
  const totalQ = allCards.reduce((s, c) => s + c.questions.length, 0);
  let totalPlayed = 0, totalCorrectSum = 0;
  allCards.forEach(c => {
    const p = State.progress[c.id];
    if (p) {
      totalPlayed += p.played || 0;
      totalCorrectSum += p.correctSum || 0;
    }
  });
  const avgPct = totalPlayed ? pct(totalCorrectSum, totalPlayed) : null;

  const el = document.getElementById('header-stats');
  el.innerHTML = `
    <div class="stat-item">
      <span class="stat-value">${totalQ}</span>
      <span class="stat-label">Întrebări</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">${allCards.length}</span>
      <span class="stat-label">Teme</span>
    </div>
    ${avgPct !== null ? `<div class="stat-item">
      <span class="stat-value" style="color:var(--green)">${avgPct}%</span>
      <span class="stat-label">Scor mediu</span>
    </div>` : ''}
  `;
}

function renderCards() {
  const grid = document.getElementById('cards-grid');
  grid.innerHTML = '';

  State.data.cards.forEach(card => {
    const p = State.progress[card.id] || {};
    const isSpecial = card.id === 'dificile';

    const lastPct = p.lastScore !== undefined ? p.lastScore : null;
    const progressHtml = lastPct !== null
      ? `<div class="card-progress-wrap">
           <div class="card-progress-bar">
             <div class="card-progress-fill" style="width:${lastPct}%;background:${card.color}"></div>
           </div>
           <p class="card-progress-text">Ultimul scor: <b>${lastPct}%</b> · Jucat de ${p.plays || 1} ori</p>
         </div>`
      : '';

    const el = document.createElement('div');
    el.className = 'card' + (isSpecial ? ' card-special' : '');
    el.style.setProperty('--card-color', card.color);
    el.innerHTML = `
      <span class="card-icon">${card.icon}</span>
      <h3 class="card-theme">${card.theme}</h3>
      <p class="card-count">${card.questions.length} întrebări</p>
      ${progressHtml}
      <button class="btn-start">Start →</button>
    `;
    el.querySelector('.btn-start').addEventListener('click', () => startCard(card.id));
    grid.appendChild(el);
  });
}

// ═══════════════════════════════════════════════════
// QUIZ LOGIC
// ═══════════════════════════════════════════════════

function startCard(cardId) {
  const card = State.data.cards.find(c => c.id === cardId);
  if (!card) return;

  State.currentCardId = cardId;
  State.shuffledQuestions = shuffle(card.questions);
  State.questionIndex = 0;
  State.score = { total: card.questions.length, correct: 0 };
  State.diffScore = {
    easy:   { total: 0, correct: 0 },
    medium: { total: 0, correct: 0 },
    hard:   { total: 0, correct: 0 },
  };
  State.userAnswers = [];

  // pre-count difficulty totals
  State.shuffledQuestions.forEach(q => {
    const d = q.difficulty || 'medium';
    if (State.diffScore[d]) State.diffScore[d].total++;
  });

  showScreen('screen-quiz');
  renderQuestion();
}

function renderQuestion() {
  const q = State.shuffledQuestions[State.questionIndex];
  const card = State.data.cards.find(c => c.id === State.currentCardId);
  const total = State.shuffledQuestions.length;
  const idx = State.questionIndex;

  // Topbar
  document.getElementById('quiz-theme-label').textContent = card.theme;
  document.getElementById('quiz-progress-label').textContent = `Întrebarea ${idx + 1} din ${total}`;

  const badge = document.getElementById('difficulty-badge');
  badge.className = 'difficulty-badge ' + (q.difficulty || 'medium');
  const diffLabel = { easy: 'Ușor', medium: 'Mediu', hard: 'Dificil' };
  badge.textContent = diffLabel[q.difficulty] || 'Mediu';

  // Progress bar
  document.getElementById('progress-fill').style.width = `${(idx / total) * 100}%`;

  // Question
  document.getElementById('question-number').textContent = `#${idx + 1}`;
  document.getElementById('question-text').textContent = q.question;

  // Hint
  State.hintShown = false;
  const hintBubble = document.getElementById('hint-bubble');
  hintBubble.classList.remove('visible');
  hintBubble.textContent = q.hint || '';
  document.getElementById('btn-hint').style.display = q.hint ? 'block' : 'none';

  // Options
  const list = document.getElementById('options-list');
  list.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.dataset.index = i;
    btn.innerHTML = `<span class="option-letter">${letters[i]}</span><span>${opt}</span>`;
    btn.addEventListener('click', () => selectAnswer(i));
    list.appendChild(btn);
  });

  // Hide explanation and next
  document.getElementById('explanation-box').style.display = 'none';
  document.getElementById('btn-next').style.display = 'none';
}

function selectAnswer(chosen) {
  const q = State.shuffledQuestions[State.questionIndex];
  const correct = q.answer;
  const isCorrect = chosen === correct;

  // update scores
  if (isCorrect) {
    State.score.correct++;
    const d = q.difficulty || 'medium';
    if (State.diffScore[d]) State.diffScore[d].correct++;
  }

  State.userAnswers.push({
    question: q.question,
    chosenText: q.options[chosen],
    correctText: q.options[correct],
    isCorrect,
    difficulty: q.difficulty,
  });

  // disable all buttons
  const btns = document.querySelectorAll('.option-btn');
  btns.forEach(b => {
    b.disabled = true;
    const i = parseInt(b.dataset.index);
    if (i === correct)     b.classList.add('correct');
    else if (i === chosen) b.classList.add('wrong');
  });

  // show explanation
  if (q.explanation) {
    document.getElementById('explanation-text').textContent = q.explanation;
    document.getElementById('explanation-box').style.display = 'flex';
  }

  // show next / finish
  const btnNext = document.getElementById('btn-next');
  const isLast = State.questionIndex >= State.shuffledQuestions.length - 1;
  btnNext.textContent = isLast ? '📊 Vezi rezultate' : 'Următoarea →';
  btnNext.style.display = 'block';
}

function nextQuestion() {
  State.questionIndex++;
  if (State.questionIndex >= State.shuffledQuestions.length) {
    finishCard();
  } else {
    renderQuestion();
    window.scrollTo(0, 0);
  }
}

// ═══════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════

function finishCard() {
  const card = State.data.cards.find(c => c.id === State.currentCardId);
  const totalQ = State.shuffledQuestions.length;
  const correctQ = State.score.correct;
  const p = pct(correctQ, totalQ);

  // Save progress
  if (!State.progress[State.currentCardId]) State.progress[State.currentCardId] = {};
  const prog = State.progress[State.currentCardId];
  prog.lastScore = p;
  prog.plays = (prog.plays || 0) + 1;
  prog.played = (prog.played || 0) + totalQ;
  prog.correctSum = (prog.correctSum || 0) + correctQ;
  saveProgress();

  // Render results
  document.getElementById('results-emoji').textContent = gradeEmoji(p);
  document.getElementById('results-theme').textContent = card.theme;

  const scoreEl = document.getElementById('score-pct');
  const rawEl   = document.getElementById('score-raw');
  scoreEl.textContent = `${p}%`;
  rawEl.textContent   = `${correctQ} / ${totalQ}`;

  // Animate ring
  const circumference = 2 * Math.PI * 50; // r=50 → C≈314
  const ringFill = document.getElementById('ring-fill');
  const offset = circumference - (p / 100) * circumference;

  // Color based on score
  const strokeColor = p >= 75 ? 'var(--green)' : p >= 50 ? 'var(--yellow)' : 'var(--red)';
  ringFill.style.stroke = strokeColor;
  scoreEl.style.color   = strokeColor;

  setTimeout(() => {
    ringFill.style.strokeDashoffset = offset;
  }, 100);

  // Difficulty bars
  function setDiffBar(diff) {
    const ds = State.diffScore[diff];
    const dp = pct(ds.correct, ds.total);
    document.getElementById(`bar-${diff}`).style.width = `${dp}%`;
    document.getElementById(`pct-${diff}`).textContent = ds.total
      ? `${ds.correct}/${ds.total} · ${dp}%`
      : '—';
  }
  setDiffBar('easy');
  setDiffBar('medium');
  setDiffBar('hard');

  // Answer summary
  const summary = document.getElementById('answer-summary');
  summary.innerHTML = State.userAnswers.map((ua, i) => `
    <div class="summary-item ${ua.isCorrect ? 'correct-item' : 'wrong-item'}">
      <span class="summary-icon">${ua.isCorrect ? '✅' : '❌'}</span>
      <div>
        <p class="summary-q">${i + 1}. ${ua.question}</p>
        ${ua.isCorrect
          ? `<p class="summary-a" style="color:var(--green)">✓ ${ua.correctText}</p>`
          : `<p class="summary-a"><span style="color:var(--red)">✗ ${ua.chosenText}</span> → <span style="color:var(--green)">✓ ${ua.correctText}</span></p>`
        }
      </div>
    </div>
  `).join('');

  showScreen('screen-results');
}

// ═══════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════

function bindEvents() {
  // Back to home from quiz
  document.getElementById('btn-back').addEventListener('click', () => {
    if (confirm('Ieși din quiz? Progresul curent se va pierde.')) {
      renderHome();
    }
  });

  // Hint
  document.getElementById('btn-hint').addEventListener('click', () => {
    State.hintShown = !State.hintShown;
    const hb = document.getElementById('hint-bubble');
    if (State.hintShown) hb.classList.add('visible');
    else hb.classList.remove('visible');
  });

  // Next question
  document.getElementById('btn-next').addEventListener('click', nextQuestion);

  // Results: retry same card
  document.getElementById('btn-retry').addEventListener('click', () => {
    startCard(State.currentCardId);
  });

  // Results: go home
  document.getElementById('btn-home').addEventListener('click', renderHome);

  // Reset all progress
  document.getElementById('btn-reset-all').addEventListener('click', () => {
    if (confirm('Ești sigur? Toate scorurile și progresul se vor șterge.')) {
      localStorage.removeItem('biochemquiz_progress');
      State.progress = {};
      renderHome();
    }
  });
}

// ═══════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════

async function init() {
  try {
    const res = await fetch('data.json');
    State.data = await res.json();
  } catch {
    document.body.innerHTML = `
      <div style="text-align:center;padding:4rem 2rem;color:#e6edf3;font-family:sans-serif">
        <h2>❌ Eroare la încărcarea datelor</h2>
        <p style="color:#8b949e;margin-top:1rem">Asigură-te că fișierul <code>data.json</code> se află în același folder cu <code>index.html</code> și accesezi site-ul printr-un server local.</p>
        <p style="color:#8b949e;margin-top:.5rem">Rulează: <code>python3 -m http.server 8080</code> și deschide <b>localhost:8080</b></p>
      </div>`;
    return;
  }

  State.progress = loadProgress();
  bindEvents();
  renderHome();
}

document.addEventListener('DOMContentLoaded', init);
