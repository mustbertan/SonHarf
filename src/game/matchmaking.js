// ═══════════════════════════════════════════
// matchmaking.js — Online Eşleşme & Oda
// Supabase Realtime ile çok oyunculu
// ═══════════════════════════════════════════
'use strict';

/* ─── Room State ─── */
let roomCode      = '';
let roomMaxPlayers= 4;
let roomPlayers   = [];
let mmTimer       = null;
let mmSeconds     = 0;
let mmChannel     = null;
let mmRoomId      = null;

/* ═══ MATCHMAKING ═══ */
function startMatchmaking() {
  Router.navigate('screen-matchmaking');
  mmSeconds = 0;
  const mmList    = document.getElementById('mm-players-list');
  const botsBtn   = document.getElementById('mm-start-bots');
  const countryEl = document.getElementById('mm-country');
  const user      = UserState.get();

  if (mmList)    mmList.innerHTML = '';
  if (botsBtn)   botsBtn.style.display = 'none';
  if (countryEl) countryEl.textContent = (user?.countryName || 'Türkiye') + ' ' + (user?.countryFlag || '🇹🇷');

  if (!SupabaseService.isConfigured) {
    showToast('⚠️ Supabase kurulmamış, bot ile oynuyorsun', 4000);
    _startFakeMatchmaking();
    return;
  }
  _startRealMatchmaking();
}

function _startFakeMatchmaking() {
  const mmList  = document.getElementById('mm-players-list');
  const fakeMM  = FAKE_NAMES.slice(0, 3).map((n, i) => ({ name: n, avatar: FAKE_AVATARS[i] }));

  mmTimer = setInterval(() => {
    mmSeconds++;
    const timerEl = document.getElementById('mm-timer');
    if (timerEl) timerEl.textContent = `Bekleniyor: ${mmSeconds}s`;

    if (mmSeconds - 1 < fakeMM.length) {
      const p = fakeMM[mmSeconds - 1];
      if (mmList) {
        mmList.innerHTML += `<div class="player-row">
          <div class="player-avatar">${p.avatar}</div>
          <div class="player-info"><div class="player-name">${p.name}</div></div>
          <span class="pill-tag pill-green">Hazır</span>
        </div>`;
      }
    }

    if (mmSeconds >= 5) {
      clearInterval(mmTimer);
      const botsBtn = document.getElementById('mm-start-bots');
      if (botsBtn) botsBtn.style.display = '';
      setTimeout(_joinWithBots, 600);
    }
  }, 1000);
}

async function _startRealMatchmaking() {
  try {
    const waiting = await SupabaseService.findWaitingRoom();

    if (waiting?.length > 0) {
      mmRoomId = waiting[0].id;
      const players = waiting[0].players || [];
      players.push(_myPlayerObj());
      await SupabaseService.updateRoom(`game_rooms?id=eq.${mmRoomId}`, { players });
      await _joinRoomChannel(mmRoomId);
    } else {
      const user = UserState.get();
      mmRoomId = 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      await SupabaseService.createRoom({
        id: mmRoomId, host_id: user.id, status: 'waiting',
        max_players: 4, current_word: null, word_history: [], players: [_myPlayerObj()],
      });
      await _joinRoomChannel(mmRoomId);
      mmTimer = setTimeout(() => {
        const botsBtn = document.getElementById('mm-start-bots');
        if (botsBtn) botsBtn.style.display = '';
        showToast('⏳ Oyuncu bulunamadı, botlarla başla', 4000);
      }, 30000);
    }

    const countInterval = setInterval(() => {
      mmSeconds++;
      const timerEl = document.getElementById('mm-timer');
      if (timerEl) timerEl.textContent = `Bekleniyor: ${mmSeconds}s`;
    }, 1000);
    mmTimer = countInterval;

  } catch (e) {
    Logger.error('Matchmaking', e);
    showToast('⚠️ Bağlantı hatası, bot ile oynuyorsun');
    _startFakeMatchmaking();
  }
}

async function _joinRoomChannel(roomId) {
  const sbClient = SupabaseService.client;
  if (!sbClient) return;
  const user = UserState.get();

  mmChannel = SupabaseService.createChannel(roomId, {
    onPresenceSync(state) {
      const mmList  = document.getElementById('mm-players-list');
      const online  = Object.values(state).flat();
      if (mmList) {
        mmList.innerHTML = online.map(p =>
          `<div class="player-row">
            <div class="player-avatar">${p.avatar || '👤'}</div>
            <div class="player-info"><div class="player-name">${escapeHtml(p.name || 'Oyuncu')}</div></div>
            <span class="pill-tag ${p.userId === user.id ? 'pill-p' : 'pill-green'}">${p.userId === user.id ? 'Sen' : 'Hazır'}</span>
          </div>`
        ).join('');
      }

      const isHost = online[0]?.userId === user.id;
      if (isHost && online.length >= 2) {
        clearInterval(mmTimer);
        _hostStartOnlineGame(roomId, online);
      }
    },
    onBroadcast(payload) {
      if (payload.type === 'game_start') _clientJoinGame(payload);
      else if (payload.type === 'word_played') _onRemoteWordPlayed(payload);
    },
    onJoined() { Logger.log('Matchmaking', 'Room joined:', roomId); }
  });
}

function _myPlayerObj() {
  const user = UserState.get();
  return { userId: user.id, name: user.username, avatar: user.avatar, score: user.totalScore || 0 };
}

async function _hostStartOnlineGame(roomId, presencePlayers) {
  const user    = UserState.get();
  const WORD_LIST = window.WORD_LIST || [];
  const players = presencePlayers.map((p, i) => ({
    id: p.userId, name: p.name, avatar: p.avatar || '👤',
    isMe: p.userId === user.id, isBot: false,
    score: 0, lives: 3, eliminated: false, comboStreak: 0,
  }));

  const starters  = WORD_LIST.filter(w => w.length >= 4);
  const startWord = starters[Math.floor(Math.random() * starters.length)] || 'araba';

  const payload = { type: 'game_start', players, startWord, roomId };

  await SupabaseService.updateRoom(`game_rooms?id=eq.${roomId}`, {
    status: 'playing', current_word: startWord, players
  });
  await SupabaseService.broadcast(mmChannel, payload);
  _startOnlineGame(players, startWord, roomId);
}

function _clientJoinGame(payload) {
  const { players, startWord, roomId } = payload;
  const user = UserState.get();
  const corrected = players.map(p => ({ ...p, isMe: p.id === user.id }));
  _startOnlineGame(corrected, startWord, roomId);
}

function _startOnlineGame(players, startWord, roomId) {
  clearInterval(mmTimer);
  clearTimeout(mmTimer);
  game = {
    mode: 'online', players, currentPlayerIdx: 0,
    currentWord: startWord, usedWords: new Set(), wordHistory: [],
    round: 1, myScore: 0, totalWords: 0, gameOver: false,
    isPractice: false, timer: UIState.get().settings.defaultTimer || 15,
    timerInterval: null, botTimer: null, roomId,
  };
  Router.navigate('screen-game', { fast: true });
  document.getElementById('game-mode-label')?.setAttribute && (document.getElementById('game-mode-label').textContent = '🌐 Online');
  setTimeout(() => { renderGamePlayers(); updateWordDisplay(); renderPowerups(); clearChat(); startTurn(); }, 300);
}

function _onRemoteWordPlayed(payload) {
  if (!game) return;
  const { word, playerId, score, nextPlayerIdx } = payload;
  const player = game.players.find(p => p.id === playerId);
  if (!player) return;

  game.usedWords.add(word);
  game.wordHistory.push({ word, playerId, isMe: false });
  game.currentWord      = word;
  game.currentPlayerIdx = nextPlayerIdx;
  game.totalWords++;

  clearInterval(game.timerInterval);
  renderGamePlayers();
  updateWordDisplay();
  updateWordHistory();
  addGameChat(`${player.avatar} ${escapeHtml(player.name)}: ${word}`);
  setTimeout(() => startTurn(), 300);
}

function _broadcastWordPlayed(word, score) {
  if (!mmChannel || !game) return;
  const user    = UserState.get();
  const active  = game.players.filter(p => !p.eliminated);
  const myIdx   = active.findIndex(p => p.isMe);
  const nextIdx = (myIdx + 1) % active.length;
  const realNext= game.players.findIndex(p => p.id === active[nextIdx].id);

  SupabaseService.broadcast(mmChannel, {
    type: 'word_played', word, playerId: user.id,
    score, nextPlayerIdx: realNext, round: game.round,
  });
}

function cancelMatchmaking() {
  clearInterval(mmTimer);
  clearTimeout(mmTimer);
  if (mmChannel) { try { mmChannel.unsubscribe(); } catch {} mmChannel = null; }
  if (mmRoomId && SupabaseService.isConfigured) {
    SupabaseService.del(`game_rooms?id=eq.${mmRoomId}`).catch(() => {});
  }
  mmRoomId = null;
  Router.navigate('screen-home');
}

/* ═══ BOT FILL ═══ */
function _joinWithBots() {
  const user = UserState.get();
  const bots = AIBot.createBots(3, selectedDifficulty);
  const players = [
    { id: user.id, name: user.username, avatar: user.avatar, isMe: true, isBot: false, score: 0, lives: 3, eliminated: false, comboStreak: 0 },
    ...bots,
  ];
  startGameWithPlayers(players, 'bot');
}

function startWithBots() { _joinWithBots(); }

/* ═══ ROOM ═══ */
function generateRoomCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

function showRoomTab(tab) {
  document.getElementById('room-create-panel').style.display = tab === 'create' ? '' : 'none';
  document.getElementById('room-join-panel').style.display   = tab === 'join'   ? '' : 'none';
  document.getElementById('tab-create').classList.toggle('active', tab === 'create');
  document.getElementById('tab-join').classList.toggle('active',   tab === 'join');
}

function changeMaxPlayers(delta) {
  roomMaxPlayers = Math.max(2, Math.min(5, roomMaxPlayers + delta));
  document.getElementById('room-max-players').textContent = roomMaxPlayers;
  document.getElementById('room-max-label').textContent   = roomMaxPlayers;
  haptic.light();
}

function copyRoomCode() {
  navigator.clipboard?.writeText(roomCode).catch(() => {});
  showToast('📋 Kod kopyalandı: ' + roomCode);
  haptic.success();
}

function renderRoomPlayers() {
  const list = document.getElementById('room-players-list');
  if (!list) return;
  let html = '';
  for (let i = 0; i < roomMaxPlayers; i++) {
    const p = roomPlayers[i];
    if (p && !p.isEmpty) {
      html += `<div class="room-player-slot ready">
        <div class="slot-num">${i + 1}</div>
        <div style="font-size:.6rem;">${p.avatar}</div>
        <div style="font-size:.4rem;font-weight:800;color:var(--text);flex:1;">${escapeHtml(p.name)}</div>
        ${p.isMe ? '<span class="pill-tag pill-p">Sen</span>' : '<span class="pill-tag pill-green">Hazır</span>'}
      </div>`;
    } else {
      html += `<div class="room-player-slot empty">
        <div class="slot-num">${i + 1}</div>
        <div style="font-size:.55rem;">👤</div>
        <div style="font-size:.38rem;color:var(--dim);flex:1;">Boş slot</div>
      </div>`;
    }
  }
  list.innerHTML = html;
  document.getElementById('room-player-count').textContent = roomPlayers.filter(p => !p.isEmpty).length;
}

async function joinRoom() {
  const code = document.getElementById('join-code-input')?.value.trim().toUpperCase();
  if (!code || code.length !== 6) { haptic.error(); showToast('⚠️ 6 haneli kod gir!'); return; }

  if (!SupabaseService.isConfigured) {
    showToast('⚠️ Supabase kurulmamış — bot ile deneme');
    setTimeout(() => startOfflineGame('bot'), 1000);
    return;
  }

  showToast('🔍 Oda aranıyor: ' + code);
  haptic.light();

  try {
    const rooms = await SupabaseService.get(`game_rooms?id=eq.${code}&status=eq.waiting`);
    if (!rooms?.length) { showToast('❌ Oda bulunamadı veya doldu'); haptic.error(); return; }
    const room    = rooms[0];
    const players = room.players || [];
    if (players.length >= room.max_players) { showToast('❌ Oda dolu!'); haptic.error(); return; }
    players.push(_myPlayerObj());
    await SupabaseService.patch(`game_rooms?id=eq.${code}`, { players });
    mmRoomId = code;
    await _joinRoomChannel(code);
    showRoomTab('create');
    document.getElementById('room-code-display').textContent = code;
    showToast('✅ Odaya katıldın: ' + code);
    haptic.success();
  } catch (e) {
    showToast('❌ Bağlantı hatası'); haptic.error();
  }
}

async function startRoomGame() {
  haptic.success();
  if (!SupabaseService.isConfigured) {
    const needed = roomMaxPlayers - roomPlayers.filter(p => !p.isEmpty).length;
    const bots   = AIBot.createBots(needed, selectedDifficulty);
    roomPlayers.push(...bots);
    startGameWithPlayers(roomPlayers);
    return;
  }
  const state  = mmChannel?.presenceState() || {};
  const online = Object.values(state).flat();
  if (online.length < 2) { showToast('⚠️ En az 2 oyuncu gerekli'); return; }
  await _hostStartOnlineGame(mmRoomId, online);
}

async function initRoom() {
  const user = UserState.get();
  roomCode = generateRoomCode();
  document.getElementById('room-code-display').textContent = roomCode;
  roomMaxPlayers = 4;
  document.getElementById('room-max-players').textContent  = roomMaxPlayers;
  document.getElementById('room-max-label').textContent    = roomMaxPlayers;
  roomPlayers = [{ name: user?.username || 'Oyuncu', avatar: user?.avatar || '🦊', isMe: true }];
  roomPlayers.push({ name: 'Bekleniyor...', avatar: '👤', isEmpty: true });
  renderRoomPlayers();
  showRoomTab('create');

  if (SupabaseService.isConfigured) {
    try {
      await SupabaseService.createRoom({
        id: roomCode, host_id: user.id, status: 'waiting',
        max_players: roomMaxPlayers, players: [_myPlayerObj()],
      });
      mmRoomId = roomCode;
      await _joinRoomChannel(roomCode);
      showToast('🏠 Oda oluşturuldu: ' + roomCode);
    } catch { showToast('⚠️ Oda oluşturulamadı — çevrimdışı mod'); }
  }
}

// Global export
window.startMatchmaking   = startMatchmaking;
window.cancelMatchmaking  = cancelMatchmaking;
window.startWithBots      = startWithBots;
window.initRoom           = initRoom;
window.showRoomTab        = showRoomTab;
window.changeMaxPlayers   = changeMaxPlayers;
window.copyRoomCode       = copyRoomCode;
window.renderRoomPlayers  = renderRoomPlayers;
window.joinRoom           = joinRoom;
window.startRoomGame      = startRoomGame;
window.mmChannel          = mmChannel;
window.mmRoomId           = mmRoomId;
window._broadcastWordPlayed= _broadcastWordPlayed;
