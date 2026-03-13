// ═══════════════════════════════════════════
// state.js — Merkezi State Yönetimi
// Event-driven, immutable-friendly state
// ═══════════════════════════════════════════
'use strict';

/* ─── Event Bus ─── */
const EventBus = (() => {
  const listeners = {};

  return {
    on(event, fn) {
      (listeners[event] = listeners[event] || []).push(fn);
      return () => this.off(event, fn); // unsubscribe fonksiyonu döner
    },
    off(event, fn) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(f => f !== fn);
      }
    },
    emit(event, data) {
      (listeners[event] || []).forEach(fn => {
        try { fn(data); } catch (e) { Logger.error('EventBus', e); }
      });
    },
    once(event, fn) {
      const wrapper = (data) => { fn(data); this.off(event, wrapper); };
      this.on(event, wrapper);
    }
  };
})();

/* ─── Local Storage Helpers ─── */
const LS = {
  PREFIX: 'wc_',
  get(key, defaultVal) {
    try {
      const v = localStorage.getItem(this.PREFIX + key);
      return v !== null ? JSON.parse(v) : defaultVal;
    } catch { return defaultVal; }
  },
  set(key, val) {
    try { localStorage.setItem(this.PREFIX + key, JSON.stringify(val)); return true; }
    catch (e) { Logger.warn('LS', 'Storage write failed', e); return false; }
  },
  del(key) {
    try { localStorage.removeItem(this.PREFIX + key); } catch {}
  }
};

/* ─── User State ─── */
const UserState = (() => {
  let _user = null;

  const DEFAULT_USER = {
    id: null,
    username: 'Oyuncu',
    avatar: '🦊',
    country: 'TR',
    countryName: 'Türkiye',
    countryFlag: '🇹🇷',
    level: 1,
    xp: 0,
    xpNeeded: 100,
    totalScore: 0,
    totalMatches: 0,
    wins: 0,
    totalWords: 0,
    bestStreak: 0,
    coins: 200,
    gems: 5,
    achievements: [],
    powerups: { extra_time: 1, hint: 1, shield: 0, pass: 1, double: 0 },
    inventory: [],
    chatMessages: 0,
    todayMatches: 0, todayWins: 0, todayWords: 0,
    weekMatches: 0, weekWins: 0,
    powerupsUsed: 0,
    joinedAt: Date.now(),
    // Yeni özellikler
    loginStreak: 0,
    lastLoginDate: null,
    seasonLevel: 1,
    seasonXP: 0,
    hasPremiumPass: false,
    claimedFree: [],
    claimedPremium: [],
    wordCollection: [],
    friends: [],
    friendReqs: [],
    sentReqs: [],
    fbConnected: false,
    fbName: null,
    fbFriends: [],
    tournamentIds: [],
  };

  return {
    get() { return _user; },

    load() {
      _user = LS.get('user', null);
      return _user;
    },

    create(data) {
      _user = {
        ...DEFAULT_USER,
        ...data,
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
        joinedAt: Date.now(),
      };
      this.save();
      EventBus.emit('user:created', _user);
      return _user;
    },

    update(partial) {
      if (!_user) return;
      _user = { ..._user, ...partial };
      this.save();
      EventBus.emit('user:updated', _user);
    },

    save() {
      if (_user) {
        LS.set('user', _user);
        EventBus.emit('user:saved', _user);
      }
    },

    addCoins(amount) {
      if (!_user) return;
      _user.coins = (_user.coins || 0) + amount;
      this.save();
      EventBus.emit('user:coins_changed', { amount, total: _user.coins });
    },

    addGems(amount) {
      if (!_user) return;
      _user.gems = (_user.gems || 0) + amount;
      this.save();
      EventBus.emit('user:gems_changed', { amount, total: _user.gems });
    },

    addXP(amount) {
      if (!_user) return;
      _user.xp += amount;
      let leveled = false;
      while (_user.xp >= _user.xpNeeded) {
        _user.xp -= _user.xpNeeded;
        _user.level++;
        _user.xpNeeded = Math.floor(_user.xpNeeded * 1.4);
        leveled = true;
        EventBus.emit('user:level_up', { level: _user.level });
      }
      this.save();
      if (leveled) EventBus.emit('user:leveled', _user.level);
    },

    reset() {
      LS.del('user');
      _user = null;
      EventBus.emit('user:reset');
    },

    isLoggedIn() { return _user !== null; }
  };
})();

/* ─── Game State ─── */
const GameState = (() => {
  let _state = null;

  const INITIAL = {
    mode: 'bot',
    players: [],
    currentPlayerIdx: 0,
    currentWord: '',
    usedWords: new Set(),
    wordHistory: [],
    round: 1,
    myScore: 0,
    totalWords: 0,
    gameOver: false,
    isPractice: false,
    timer: 15,
    timerInterval: null,
    botTimer: null,
    roomId: null,
    startedAt: null,
  };

  return {
    get() { return _state; },

    start(config) {
      _state = {
        ...INITIAL,
        ...config,
        usedWords: new Set(),
        wordHistory: [],
        startedAt: Date.now(),
      };
      EventBus.emit('game:started', _state);
      return _state;
    },

    update(partial) {
      if (!_state) return;
      _state = { ..._state, ...partial };
      EventBus.emit('game:updated', _state);
    },

    addWord(entry) {
      if (!_state) return;
      _state.usedWords.add(entry.word);
      _state.wordHistory.push(entry);
      _state.totalWords++;
      _state.currentWord = entry.word;
      EventBus.emit('game:word_added', entry);
    },

    end(forfeited = false) {
      if (!_state) return;
      _state.gameOver = true;
      clearInterval(_state.timerInterval);
      clearTimeout(_state.botTimer);
      EventBus.emit('game:ended', { state: _state, forfeited });
    },

    clear() {
      if (_state) {
        clearInterval(_state.timerInterval);
        clearTimeout(_state.botTimer);
      }
      _state = null;
    }
  };
})();

/* ─── UI State ─── */
const UIState = (() => {
  let _state = {
    currentScreen: 'screen-home',
    prevScreen: 'screen-home',
    modalsOpen: new Set(),
    isLoading: false,
    settings: {
      sfx: true,
      music: true,
      hapticEnabled: true,
      defaultTimer: 15,
    }
  };

  return {
    get() { return _state; },

    setScreen(id) {
      _state.prevScreen = _state.currentScreen;
      _state.currentScreen = id;
      EventBus.emit('ui:screen_changed', { from: _state.prevScreen, to: id });
    },

    openModal(id) {
      _state.modalsOpen.add(id);
      EventBus.emit('ui:modal_opened', id);
    },

    closeModal(id) {
      _state.modalsOpen.delete(id);
      EventBus.emit('ui:modal_closed', id);
    },

    isModalOpen(id) { return _state.modalsOpen.has(id); },

    setLoading(val) {
      _state.isLoading = val;
      EventBus.emit('ui:loading_changed', val);
    },

    loadSettings() {
      _state.settings = LS.get('settings', _state.settings);
      return _state.settings;
    },

    saveSettings() {
      LS.set('settings', _state.settings);
      EventBus.emit('ui:settings_changed', _state.settings);
    },

    updateSetting(key, val) {
      _state.settings[key] = val;
      this.saveSettings();
    }
  };
})();

/* ─── Match State (Multiplayer) ─── */
const MatchState = (() => {
  let _state = {
    roomId: null,
    channel: null,
    isHost: false,
    players: [],
    status: 'idle', // idle | waiting | playing | ended
    mmSeconds: 0,
    mmTimer: null,
  };

  return {
    get() { return _state; },
    update(partial) {
      _state = { ..._state, ...partial };
      EventBus.emit('match:updated', _state);
    },
    reset() {
      if (_state.channel) {
        try { _state.channel.unsubscribe(); } catch {}
      }
      clearInterval(_state.mmTimer);
      _state = { roomId: null, channel: null, isHost: false, players: [], status: 'idle', mmSeconds: 0, mmTimer: null };
      EventBus.emit('match:reset');
    }
  };
})();

/* ─── Logger ─── */
const Logger = (() => {
  const PREFIX = '[SonHarf]';
  const IS_DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  return {
    log(module, ...args)   { if (IS_DEV) console.log(`${PREFIX}[${module}]`, ...args); },
    warn(module, ...args)  { console.warn(`${PREFIX}[${module}]`, ...args); },
    error(module, ...args) { console.error(`${PREFIX}[${module}]`, ...args); Analytics.logError(module, args[0]); },
    info(module, ...args)  { if (IS_DEV) console.info(`${PREFIX}[${module}]`, ...args); }
  };
})();

/* ─── Analytics Hooks ─── */
const Analytics = (() => {
  const queue = [];

  function flush() {
    if (!queue.length) return;
    // Gerçek analytics (Firebase/Amplitude) buraya bağlanır
    Logger.log('Analytics', `${queue.length} event queued`);
    queue.length = 0;
  }

  setInterval(flush, 30000);

  return {
    track(event, props = {}) {
      queue.push({ event, props, ts: Date.now() });
      Logger.log('Analytics', 'track:', event, props);
    },
    logError(module, err) {
      queue.push({ event: 'error', props: { module, msg: String(err) }, ts: Date.now() });
    },
    setUser(userId) {
      Logger.log('Analytics', 'setUser:', userId);
      // gtag('set', { user_id: userId });
    }
  };
})();

/* ─── Performance Monitor ─── */
const Perf = (() => {
  const marks = {};
  return {
    start(label) { marks[label] = performance.now(); },
    end(label) {
      if (!marks[label]) return;
      const ms = performance.now() - marks[label];
      delete marks[label];
      if (ms > 100) Logger.warn('Perf', `${label} took ${ms.toFixed(1)}ms`);
      return ms;
    }
  };
})();

// Global export
window.EventBus  = EventBus;
window.LS        = LS;
window.UserState = UserState;
window.GameState = GameState;
window.UIState   = UIState;
window.MatchState= MatchState;
window.Logger    = Logger;
window.Analytics = Analytics;
window.Perf      = Perf;
