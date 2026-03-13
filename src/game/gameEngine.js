// ═══════════════════════════════════════════
// gameEngine.js — Oyun Motoru v2.0
// Yeni: Ğ kuralı, dahili klavye, oyun içi bildirim
// ═══════════════════════════════════════════
'use strict';

/* ─── Oyun Durumu ─── */
let game = null;

/* ─── Zorluk Konfigürasyonu ─── */
let selectedDifficulty = 'easy';

const DIFFICULTY_CONFIG = {
  easy:   { label:'😊 Kolay',  desc:'Bot rastgele kısa kelimeler seçer. Sıklıkla hata yapar.',    delay:[2500,4500], algorithm:'random_short'  },
  normal: { label:'🎯 Normal', desc:'Bot ortalama uzunlukta kelimeler seçer. Bazen takılır.',       delay:[1500,3000], algorithm:'random'        },
  hard:   { label:'🔥 Zor',    desc:'Bot uzun ve zorlu kelimeler seçer. Hata yapmaz.',              delay:[800,1800],  algorithm:'longest_top5'  },
  insane: { label:'💀 Delice', desc:'Bot her zaman en uzun kelimeyi seçer. Neredeyse yenilmez.',   delay:[400,900],   algorithm:'longest'       },
};

function selectDifficulty(level) {
  selectedDifficulty = level;
  document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('diff-' + level)?.classList.add('selected');
  const cfg = DIFFICULTY_CONFIG[level] || DIFFICULTY_CONFIG.normal;
  const titleEl = document.getElementById('diff-preview-title');
  const descEl  = document.getElementById('diff-preview-desc');
  if (titleEl) titleEl.textContent = cfg.label;
  if (descEl)  descEl.textContent  = cfg.desc;
  haptic.light();
}
window.selectDifficulty = selectDifficulty;

function startBotGameWithDifficulty() {
  haptic.success();
  startOfflineGame('bot');
}
window.startBotGameWithDifficulty = startBotGameWithDifficulty;

/* ═══════════════════════════════════════════
   DAHİLİ KLAVYE
═══════════════════════════════════════════ */
let gameKeyboardVisible = false;

function toggleGameKeyboard() {
  gameKeyboardVisible = !gameKeyboardVisible;
  const kb  = document.getElementById('game-keyboard');
  const btn = document.getElementById('kb-toggle-btn');
  if (kb)  kb.style.display = gameKeyboardVisible ? '' : 'none';
  if (btn) btn.classList.toggle('active', gameKeyboardVisible);
  if (gameKeyboardVisible) {
    // Telefon klavyesini kapat
    const input = document.getElementById('word-input');
    if (input) { input.readOnly = true; input.blur(); input.readOnly = false; }
  }
  haptic.light();
}

function kbPress(char) {
  const input = document.getElementById('word-input');
  if (!input || input.disabled) return;
  input.value += char;
  onWordInput();
  haptic.light();
}

function kbBackspace() {
  const input = document.getElementById('word-input');
  if (!input || input.disabled) return;
  input.value = input.value.slice(0, -1);
  onWordInput();
  haptic.light();
}

window.toggleGameKeyboard = toggleGameKeyboard;
window.kbPress   = kbPress;
window.kbBackspace = kbBackspace;

/* ═══════════════════════════════════════════
   OYUN İÇİ BİLDİRİM
═══════════════════════════════════════════ */
let _gameNotifTimer = null;

function showGameNotification(msg, type = '', dur = 2000) {
  const el = document.getElementById('game-notification');
  if (!el) return;
  el.textContent = msg;
  el.className   = 'game-notification show' + (type ? ' ' + type : '');
  clearTimeout(_gameNotifTimer);
  _gameNotifTimer = setTimeout(() => el.classList.remove('show'), dur);
}
window.showGameNotification = showGameNotification;

/* ═══════════════════════════════════════════
   Ğ KURALI
═══════════════════════════════════════════ */
function isWordEndingInGH(word) {
  return word && word.slice(-1).toLowerCase() === 'ğ';
}
window.isWordEndingInGH = isWordEndingInGH;

/* ═══════════════════════════════════════════
   OYUN BAŞLATMA
═══════════════════════════════════════════ */
function startOfflineGame(mode) {
  const user = UserState.get();
  if (!user) return;
  let players = [];

  if (mode === 'bot') {
    players = [
      { id: user.id, name: user.username, avatar: user.avatar, isMe: true,  isBot: false, botDifficulty: null,               score:0, lives:3, eliminated:false, comboStreak:0 },
      { id: 'bot_1', name: 'Bot',         avatar: '🤖',        isMe: false, isBot: true,  botDifficulty: selectedDifficulty, score:0, lives:3, eliminated:false, comboStreak:0 },
    ];
  } else if (mode === 'pass') {
    const p2name = prompt('2. oyuncunun adı:') || 'Oyuncu 2';
    players = [
      { id: user.id, name: user.username, avatar: user.avatar, isMe: true,  isBot: false, score:0, lives:3, eliminated:false, comboStreak:0 },
      { id: 'p2',    name: p2name,        avatar: '🎮',        isMe: false, isBot: false, score:0, lives:3, eliminated:false, comboStreak:0 },
    ];
  } else if (mode === 'practice') {
    players = [
      { id: user.id, name: user.username, avatar: user.avatar, isMe: true, isBot: false, score:0, lives:99, eliminated:false, comboStreak:0 },
    ];
  }
  startGameWithPlayers(players, mode);
}

function startGameWithPlayers(players, mode = 'bot') {
  const settings = UIState.get().settings;
  const timer    = settings.defaultTimer || 15;

  game = {
    mode,
    players:          players.map((p, i) => ({ ...p, idx: i })),
    currentPlayerIdx: 0,
    currentWord:      '',
    usedWords:        new Set(),
    wordHistory:      [],
    round:            1,
    myScore:          0,
    totalWords:       0,
    gameOver:         false,
    isPractice:       mode === 'practice',
    timer,
    timerInterval:    null,
    botTimer:         null,
    roomId:           null,
    startedAt:        Date.now(),
    activeDouble:     false,
  };
  // Global referans
  window.game = game;

  game.currentWord = pickStartWord();
  Router.navigate('screen-game', { fast: true });

  const modeLabels = { bot:'Bot ile Oyna', pass:'Sıra Sende', practice:'Pratik Modu', online:'🌐 Online' };
  setTimeout(() => {
    const modeEl = document.getElementById('game-mode-label');
    if (modeEl) modeEl.textContent = modeLabels[mode] || mode;
    renderGamePlayers();
    updateWordDisplay();
    renderPowerups();
    clearGameChat();
    startTurn();
    Analytics.track('game_start', { mode });
  }, 300);
}

function pickStartWord() {
  const WORD_LIST = window.WORD_LIST || [];
  const starters  = WORD_LIST.filter(w => w.length >= 4 && !isWordEndingInGH(w));
  return starters.length
    ? starters[Math.floor(Math.random() * starters.length)]
    : 'araba';
}

/* ─── Oyuncu Kartları Render ─── */
function renderGamePlayers() {
  const container = document.getElementById('game-players-list');
  if (!container || !game) return;

  container.innerHTML = game.players.map((p, i) => {
    const isActive = i === game.currentPlayerIdx && !p.eliminated;
    const lives    = '❤️'.repeat(Math.max(0, Math.min(p.lives, 3))) || '💀';
    return `<div class="game-player-chip ${isActive ? 'active' : ''} ${p.eliminated ? 'eliminated' : ''} ${p.isMe ? 'me' : ''}">
      ${isActive ? '<div class="gpc-active-dot"></div>' : ''}
      <div class="gpc-avatar">${p.avatar}</div>
      <div class="gpc-name">${escapeHtml(p.name)}</div>
      <div class="gpc-score">${p.score}</div>
      <div class="gpc-lives">${lives}</div>
    </div>`;
  }).join('');
}

/* ─── Sıra Başlatma ─── */
function startTurn() {
  if (!game || game.gameOver) return;
  clearInterval(game.timerInterval);
  clearTimeout(game.botTimer);

  const player = game.players[game.currentPlayerIdx];
  if (!player || player.eliminated) { nextTurn(); return; }

  const isMe      = game.isPractice ? true : player.isMe;
  const input     = document.getElementById('word-input');
  const submitBtn = document.getElementById('submit-btn');
  const statusEl  = document.getElementById('word-status-text');

  if (input)     { input.disabled = !isMe; if (isMe) { input.value = ''; if (!gameKeyboardVisible) input.focus(); } }
  if (submitBtn) submitBtn.disabled = !isMe;
  if (statusEl)  {
    statusEl.textContent = isMe
      ? `⌨️ ${escapeHtml(player.name)}, kelimeni yaz!`
      : `⏳ ${escapeHtml(player.name)} düşünüyor...`;
  }

  updateWordDisplay();

  // Timer
  let timeLeft = game.timer;
  updateTimerRing(timeLeft, game.timer);
  const roundEl = document.getElementById('game-round');
  if (roundEl) roundEl.textContent = game.round;

  game.timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerRing(timeLeft, game.timer);
    const ring = document.getElementById('timer-ring');
    if (ring) {
      ring.classList.toggle('danger', timeLeft <= 5);
      ring.classList.toggle('warn',   timeLeft > 5 && timeLeft <= 8);
    }
    if (timeLeft <= 0) {
      clearInterval(game.timerInterval);
      onTimeout(player);
    }
  }, 1000);

  if (!isMe && player.isBot) botPlay(player);
}

function updateTimerRing(current, total) {
  const ring    = document.getElementById('timer-ring');
  const timerEl = document.getElementById('timer-text');
  if (ring) {
    const circumference = 175.9;
    ring.style.strokeDashoffset = circumference - (current / total) * circumference;
  }
  if (timerEl) timerEl.textContent = current;
}

/* ─── Timeout ─── */
function onTimeout(player) {
  clearInterval(game?.timerInterval);
  if (!game || game.gameOver) return;
  haptic.error();
  showGameNotification(`⏰ ${escapeHtml(player.name)} süreyi doldurdu!`, 'warn');
  penalizePlayer(player);
}

/* ─── Bot Oynama ─── */
function botPlay(player) {
  if (!game || game.gameOver) return;
  const lastChar = game.currentWord.slice(-1).toLowerCase();
  const cfg      = DIFFICULTY_CONFIG[player.botDifficulty || selectedDifficulty] || DIFFICULTY_CONFIG.normal;
  const [minD, maxD] = cfg.delay;
  const delay    = minD + Math.random() * (maxD - minD);

  clearTimeout(game.botTimer);
  game.botTimer = setTimeout(() => {
    if (!game || game.players[game.currentPlayerIdx] !== player) return;

    const WORD_LIST = window.WORD_LIST || [];
    // Ğ ile bitecek kelimeler de yasak (bota da uygula)
    let candidates = WORD_LIST.filter(w => w[0] === lastChar && !game.usedWords.has(w) && !isWordEndingInGH(w));

    let word = null;
    switch (cfg.algorithm) {
      case 'random_short':
        candidates = candidates.filter(w => w.length <= 5);
        word = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
        break;
      case 'random':
        word = candidates.length ? candidates[Math.floor(Math.random() * Math.min(candidates.length, 15))] : null;
        break;
      case 'longest_top5':
        candidates.sort((a, b) => b.length - a.length);
        word = candidates.length ? candidates[Math.floor(Math.random() * Math.min(candidates.length, 5))] : null;
        break;
      case 'longest':
        word = candidates.sort((a, b) => b.length - a.length)[0] || null;
        break;
    }

    if (!word) { onTimeout(player); return; }
    processWord(word, player, true, 'bot_ai');
  }, delay);
}

/* ─── Kelime Input ─── */
function onWordInput() {
  const input = document.getElementById('word-input');
  if (input) input.value = input.value.toLowerCase();
}

function onWordKeyDown(e) {
  if (e.key === 'Enter') { e.preventDefault(); submitWord(); }
}

/* ─── Kelime Gönderme ─── */
async function submitWord() {
  const input = document.getElementById('word-input');
  const word  = input?.value.trim().toLowerCase();
  if (!word || !game) return;

  const player = game.players[game.currentPlayerIdx];
  if (!player || player.eliminated || (!game.isPractice && !player.isMe)) return;

  if (input)     input.disabled = true;
  document.getElementById('submit-btn')?.setAttribute('disabled', true);

  // Ğ kuralı — can kaybı YOK
  if (isWordEndingInGH(word)) {
    if (input) { input.disabled = false; input.value = ''; }
    document.getElementById('submit-btn')?.removeAttribute('disabled');
    showGameNotification('⚠️ "Ğ" ile biten kelimeler yasaktır!\nYeni bir kelime yaz.', 'warn', 3000);
    haptic.error();
    startTurn();
    return;
  }

  const result = await WordValidator.validate(word);
  processWord(word, player, result.valid, result.source);
}

/* ─── Kelime İşleme ─── */
function processWord(word, player, isKnownValid, validSource) {
  if (!game || game.gameOver) return;
  clearInterval(game.timerInterval);

  const input     = document.getElementById('word-input');
  const statusEl  = document.getElementById('word-status-text');
  const lastChar  = game.currentWord.slice(-1).toLowerCase();

  // Zincir kontrolü
  if (word[0] !== lastChar) {
    if (input) { input.disabled = false; input.value = ''; }
    document.getElementById('submit-btn')?.removeAttribute('disabled');
    showGameNotification(`❌ "${lastChar.toUpperCase()}" ile başlamalı!`, 'error');
    haptic.error();
    if (!player.isBot) startTurn();
    return;
  }

  // Tekrar kontrolü
  if (game.usedWords.has(word)) {
    if (input) { input.disabled = false; input.value = ''; }
    document.getElementById('submit-btn')?.removeAttribute('disabled');
    showGameNotification('❌ Bu kelime zaten kullanıldı!', 'error');
    haptic.error();
    if (!player.isBot) startTurn();
    return;
  }

  // Geçersiz kelime
  if (!isKnownValid && validSource !== 'bot_ai') {
    if (input) { input.disabled = false; input.value = ''; }
    document.getElementById('submit-btn')?.removeAttribute('disabled');
    showGameNotification('❌ Geçersiz kelime!', 'error');
    haptic.error();
    penalizePlayer(player);
    return;
  }

  // ─── Geçerli Kelime ─── //
  const timeEl   = document.getElementById('timer-text');
  const timeLeft = parseInt(timeEl?.textContent || '0') || 0;
  const comboMult= 1 + (player.comboStreak || 0) * 0.1;
  const hasDouble= game.activeDouble && (player.isMe || game.isPractice);
  const pts      = Math.floor((word.length * 10 + Math.floor(timeLeft / 2)) * comboMult * (hasDouble ? 2 : 1));
  game.activeDouble = false;

  player.score      = (player.score || 0) + pts;
  player.comboStreak= (player.comboStreak || 0) + 1;

  if (player.isMe || game.isPractice) {
    game.myScore = (game.myScore || 0) + pts;
    const user = UserState.get();
    if (user) {
      user.totalWords  = (user.totalWords  || 0) + 1;
      user.todayWords  = (user.todayWords  || 0) + 1;
      user.bestStreak  = Math.max(user.bestStreak || 0, player.comboStreak);
      UserState.save();
    }
  }

  game.usedWords.add(word);
  game.wordHistory.push({ word, playerId: player.id, isMe: player.isMe || game.isPractice, score: pts });
  game.currentWord = word;
  game.totalWords++;
  window.game = game;

  // Koleksiyon
  if (window.WordCollectionSystem) WordCollectionSystem.add(word);
  // Offline dict
  if (window.addToOfflineDict) addToOfflineDict(word);

  // Skor güncelle
  const scoreEl = document.getElementById('game-score-display');
  if (scoreEl && (player.isMe || game.isPractice)) scoreEl.textContent = `⭐ ${game.myScore}`;

  haptic.success();
  if (input) input.value = '';

  // Bildirim
  if (player.comboStreak >= 3) showGameNotification(`🔥 ${player.comboStreak}x KOMBO! +${pts}`, 'success', 1500);

  renderCombo(player.comboStreak);
  updateWordDisplay();
  updateWordHistory();
  renderGamePlayers();
  addGameChatMsg(`${player.avatar} ${escapeHtml(player.name)}: ${word} (+${pts})`);

  // Multiplayer broadcast
  if (game.roomId && window._broadcastWordPlayed) {
    _broadcastWordPlayed(word, pts);
  }

  setTimeout(() => nextTurn(), 600);
}

/* ─── Ceza ─── */
function penalizePlayer(player) {
  if (!player || !game) return;

  // Kalkan powerup var mı?
  if (player.shield) {
    player.shield = false;
    showGameNotification('🛡️ Kalkan koruma sağladı!', 'success');
    player.comboStreak = 0;
    renderGamePlayers();
    setTimeout(() => nextTurn(), 800);
    return;
  }

  player.comboStreak = 0;
  player.lives = (player.lives || 3) - 1;

  if (player.lives <= 0) {
    player.eliminated = true;
    showGameNotification(`💀 ${escapeHtml(player.name)} elendi!`, 'error', 2000);
    haptic.heavy();
  }

  renderGamePlayers();
  const active = game.players.filter(p => !p.eliminated);
  if (active.length <= 1 && !game.isPractice) {
    setTimeout(() => endGame(), 800);
  } else {
    setTimeout(() => nextTurn(), 800);
  }
}

/* ─── Sonraki Sıra ─── */
function nextTurn() {
  if (!game || game.gameOver) return;
  const active = game.players.filter(p => !p.eliminated);
  if (active.length <= 1 && !game.isPractice) { endGame(); return; }

  let next  = (game.currentPlayerIdx + 1) % game.players.length;
  let guard = 0;
  while (game.players[next]?.eliminated && guard++ < game.players.length) {
    next = (next + 1) % game.players.length;
  }
  if (next === 0 && game.currentPlayerIdx !== 0) game.round++;
  game.currentPlayerIdx = next;
  window.game = game;
  startTurn();
}

/* ─── Word Display ─── */
function updateWordDisplay() {
  if (!game) return;
  const w      = game.currentWord || '';
  const before = w.slice(0, -1);
  const last   = w.slice(-1);
  const el     = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  el('word-before-last', before);
  el('word-last-char',   last || '?');
  el('next-start-hint',  last.toUpperCase() || '?');
}

function updateWordHistory() {
  const hist = document.getElementById('word-history');
  if (!hist || !game) return;
  hist.innerHTML = game.wordHistory.slice(-15).map(h =>
    `<div class="word-chip ${h.isMe ? 'mine' : ''} valid">${escapeHtml(h.word)}</div>`
  ).join('');
  hist.scrollLeft = hist.scrollWidth;
}

/* ─── Combo ─── */
function renderCombo(streak) {
  const area = document.getElementById('combo-area');
  if (!area) return;
  area.innerHTML = streak >= 3
    ? `<div class="combo-display"><div class="combo-text">🔥 ${streak}x KOMBO!</div></div>`
    : '';
}

/* ─── Powerups ─── */
function renderPowerups() {
  const bar  = document.getElementById('powerups-bar');
  if (!bar || !game) return;
  const user = UserState.get();
  const pu   = user?.powerups || {};
  const POWERUP_DEFS = window.POWERUP_DEFS || [];
  bar.innerHTML = POWERUP_DEFS.map(p => {
    const count = pu[p.id] || 0;
    return `<button class="powerup-btn" onclick="usePowerup('${p.id}')" ${count === 0 ? 'disabled' : ''}>
      <span class="powerup-icon">${p.icon}</span>
      <span class="powerup-label">${p.label}</span>
      ${count > 0 ? `<span class="powerup-count">${count}</span>` : ''}
    </button>`;
  }).join('');
}

function usePowerup(id) {
  const user  = UserState.get();
  const count = user?.powerups?.[id] || 0;
  if (!count || !game || game.gameOver) { showToast('⚠️ Bu güç kullanılamaz!'); return; }

  const player = game.players[game.currentPlayerIdx];
  if (!game.isPractice && !player?.isMe) { showToast('⚠️ Sıran değil!'); return; }

  user.powerups[id]--;
  user.powerupsUsed = (user.powerupsUsed || 0) + 1;
  UserState.save();

  const timerEl = document.getElementById('timer-text');
  switch (id) {
    case 'extra_time': {
      let tl = parseInt(timerEl?.textContent || '0') + 15;
      tl = Math.min(tl, 60);
      if (timerEl) timerEl.textContent = tl;
      showGameNotification('⏰ +15 saniye!', 'success');
      break;
    }
    case 'hint': {
      const lastChar  = game.currentWord.slice(-1).toLowerCase();
      const WORD_LIST = window.WORD_LIST || [];
      const hints     = WORD_LIST.filter(w => w[0] === lastChar && !game.usedWords.has(w) && !isWordEndingInGH(w));
      if (hints.length) {
        const h = hints[Math.floor(Math.random() * hints.length)];
        showGameNotification(`💡 İpucu: "${h[0].toUpperCase()}${h[1]}"...`, 'success');
      }
      break;
    }
    case 'shield':
      player.shield = true;
      showGameNotification('🛡️ Kalkan aktif! Bir hata korunacak.', 'success');
      break;
    case 'pass':
      showGameNotification('⏭️ Sıra geçildi!', '');
      renderPowerups();
      nextTurn();
      return;
    case 'double':
      game.activeDouble = true;
      showGameNotification('2️⃣ Çift puan aktif!', 'success');
      break;
  }

  renderPowerups();
  haptic.medium();
  checkAchievements();
}

/* ─── Game Chat ─── */
let gameChatOpen = false;
const _gameChatMsgs = [];

function toggleGameChat() {
  gameChatOpen = !gameChatOpen;
  const panel = document.getElementById('game-chat-panel');
  if (panel) panel.style.display = gameChatOpen ? 'flex' : 'none';
}

function addGameChatMsg(text) {
  const now  = new Date();
  const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
  _gameChatMsgs.push({ text, time });
  if (_gameChatMsgs.length > 50) _gameChatMsgs.shift();
  renderGameChatMsgs();
}

function sendGameChat() {
  const input = document.getElementById('game-chat-input');
  const text  = input?.value.trim();
  const user  = UserState.get();
  if (!text || !user) return;
  addGameChatMsg(`${user.avatar} ${escapeHtml(user.username)}: ${escapeHtml(filterProfanity(text))}`);
  if (input) input.value = '';
}

function renderGameChatMsgs() {
  const cont = document.getElementById('game-chat-messages');
  if (!cont) return;
  cont.innerHTML = _gameChatMsgs.map(m =>
    `<div style="font-size:.33rem;color:var(--muted);margin-bottom:.1rem;">
      <span style="color:var(--dim);">${m.time}</span> ${m.text}
    </div>`
  ).join('');
  cont.scrollTop = cont.scrollHeight;
}

function clearGameChat() {
  _gameChatMsgs.length = 0;
  gameChatOpen = false;
  const panel = document.getElementById('game-chat-panel');
  if (panel) panel.style.display = 'none';
}

/* ─── Game Menu ─── */
function showGameMenu() {
  clearInterval(game?.timerInterval);
  openModal('game-menu-modal');
}

function forfeitGame() {
  closeModal('game-menu-modal');
  clearInterval(game?.timerInterval);
  clearTimeout(game?.botTimer);
  endGame(true);
}

/* ─── Oyun Sonu ─── */
function endGame(forfeited = false) {
  if (!game) return;
  clearInterval(game.timerInterval);
  clearTimeout(game.botTimer);
  haptic.heavy();

  const sorted = [...(game.players || [])].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const iWon   = winner?.isMe || game.isPractice;
  const user   = UserState.get();

  if (user && game) {
    user.totalMatches = (user.totalMatches || 0) + 1;
    user.todayMatches = (user.todayMatches || 0) + 1;
    user.weekMatches  = (user.weekMatches  || 0) + 1;

    if (!forfeited && (iWon || game.isPractice)) {
      user.wins      = (user.wins      || 0) + 1;
      user.todayWins = (user.todayWins || 0) + 1;
      user.weekWins  = (user.weekWins  || 0) + 1;
    }

    const earnedXP    = Math.floor((game.myScore || 0) * 0.5) + (iWon ? 50 : 10);
    const earnedCoins = Math.floor((game.myScore || 0) * 0.1) + (iWon ? 100 : 20);

    user.xp         = (user.xp        || 0) + earnedXP;
    user.coins      = (user.coins     || 0) + earnedCoins;
    user.totalScore = (user.totalScore|| 0) + (game.myScore || 0);
    user.gems       = (user.gems      || 0) + (iWon ? 1 : 0);

    while (user.xp >= (user.xpNeeded || 100)) {
      user.xp      -= user.xpNeeded;
      user.level    = (user.level || 1) + 1;
      user.xpNeeded = Math.floor((user.xpNeeded || 100) * 1.4);
      showAchievementPopup('⬆️', `Seviye ${user.level}!`);
    }

    // Sezon XP
    if (window.BattlePassSystem) BattlePassSystem.addXP(earnedXP);

    // Kelime koleksiyonu
    if (game.wordHistory && window.WordCollectionSystem) {
      game.wordHistory.forEach(h => { if (h.word) WordCollectionSystem.add(h.word); });
    }

    // Paylaşım istatistikleri
    window.lastGameStats = {
      score:  game.myScore || 0,
      words:  game.wordHistory?.length || 0,
      result: iWon ? '🏆' : '😢',
      streak: user.bestStreak || 0,
    };

    UserState.save();
    checkAchievements();
    refreshCurrencyDisplays();

    // Sonuç ekranı
    Router.navigate('screen-result', { fast: true });

    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('result-crown',  iWon ? '🏆' : '😢');
    set('result-winner', iWon ? (game.isPractice ? 'Pratik Bitti!' : 'Kazandın!') : `${winner?.name || 'Bot'} Kazandı!`);
    set('result-sub',    `${game.totalWords} kelime söylendi`);

    const scoresEl = document.getElementById('result-scores');
    if (scoresEl) {
      scoresEl.innerHTML = sorted.map((p, i) =>
        `<div class="lb-row ${['top1','top2','top3'][i]||''}" style="margin-bottom:.17rem;">
          <div class="lb-rank">${['🥇','🥈','🥉'][i]||i+1}</div>
          <div class="lb-avatar">${p.avatar}</div>
          <div class="lb-info"><div class="lb-name">${escapeHtml(p.name)}</div></div>
          <div class="lb-score">${p.score} pts</div>
        </div>`
      ).join('');
    }

    const rewardsEl = document.getElementById('result-rewards');
    if (rewardsEl) {
      rewardsEl.innerHTML = `
        <div class="card" style="flex:1;text-align:center;">
          <div style="font-size:.55rem;">⭐</div>
          <div style="font-size:.5rem;font-weight:800;color:var(--p2);">+${earnedXP} XP</div>
          <div style="font-size:.3rem;color:var(--muted);">Deneyim</div>
        </div>
        <div class="card" style="flex:1;text-align:center;">
          <div style="font-size:.55rem;">🪙</div>
          <div style="font-size:.5rem;font-weight:800;color:var(--gold);">+${earnedCoins}</div>
          <div style="font-size:.3rem;color:var(--muted);">Coin</div>
        </div>
        ${iWon ? `<div class="card" style="flex:1;text-align:center;">
          <div style="font-size:.55rem;">💎</div>
          <div style="font-size:.5rem;font-weight:800;color:var(--acc3);">+1</div>
          <div style="font-size:.3rem;color:var(--muted);">Gem</div>
        </div>` : ''}`;
    }

    pushAd('result-banner');
    Analytics.track('game_end', { mode: game.mode, won: iWon, score: game.myScore });
  }
}

function playAgain() {
  if (!game) { Router.navigate('screen-home'); return; }
  const mode        = game.mode;
  const prevPlayers = game.players;
  Router.navigate('screen-home');
  setTimeout(() => startGameWithPlayers(
    prevPlayers.map(p => ({ ...p, score:0, lives:3, eliminated:false, comboStreak:0, shield:false })),
    mode
  ), 500);
}

/* ─── Sesli Giriş ─── */
let speechRecognition = null;
let voiceActive       = false;

function toggleVoice() {
  const btn = document.getElementById('voice-btn');
  if (!voiceActive) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast('⚠️ Ses tanıma bu tarayıcıda desteklenmiyor'); return; }
    if (!speechRecognition) {
      speechRecognition            = new SR();
      speechRecognition.lang       = 'tr-TR';
      speechRecognition.continuous = false;
      speechRecognition.interimResults = true;
      speechRecognition.onresult   = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript.trim().toLowerCase();
          const inp = document.getElementById('word-input');
          if (inp) { inp.value = t; onWordInput(); }
          if (e.results[i].isFinal) { showToast(`🎤 "${t}"`); setTimeout(() => submitWord(), 500); }
        }
      };
      speechRecognition.onerror = () => stopVoice();
      speechRecognition.onend   = () => stopVoice();
    }
    voiceActive = true;
    if (btn) { btn.classList.add('active'); btn.textContent = '🔴 Dinliyor'; }
    haptic.medium();
    try { speechRecognition.start(); } catch {}
  } else {
    stopVoice();
  }
}

function stopVoice() {
  voiceActive = false;
  const btn = document.getElementById('voice-btn');
  if (btn) { btn.classList.remove('active'); btn.textContent = '🎤 Ses'; }
  try { speechRecognition?.stop(); } catch {}
}

/* ─── Global exports ─── */
window.game                   = game;
window.selectedDifficulty     = selectedDifficulty;
window.DIFFICULTY_CONFIG      = DIFFICULTY_CONFIG;
window.startOfflineGame       = startOfflineGame;
window.startGameWithPlayers   = startGameWithPlayers;
window.pickStartWord          = pickStartWord;
window.renderGamePlayers      = renderGamePlayers;
window.startTurn              = startTurn;
window.updateTimerRing        = updateTimerRing;
window.onTimeout              = onTimeout;
window.botPlay                = botPlay;
window.onWordInput            = onWordInput;
window.onWordKeyDown          = onWordKeyDown;
window.submitWord             = submitWord;
window.processWord            = processWord;
window.penalizePlayer         = penalizePlayer;
window.nextTurn               = nextTurn;
window.updateWordDisplay      = updateWordDisplay;
window.updateWordHistory      = updateWordHistory;
window.renderCombo            = renderCombo;
window.renderPowerups         = renderPowerups;
window.usePowerup             = usePowerup;
window.toggleGameChat         = toggleGameChat;
window.addGameChatMsg         = addGameChatMsg;
window.sendGameChat           = sendGameChat;
window.renderGameChatMsgs     = renderGameChatMsgs;
window.clearGameChat          = clearGameChat;
window.showGameMenu           = showGameMenu;
window.forfeitGame            = forfeitGame;
window.endGame                = endGame;
window.playAgain              = playAgain;
window.toggleVoice            = toggleVoice;
window.stopVoice              = stopVoice;
