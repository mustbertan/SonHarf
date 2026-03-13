// ═══════════════════════════════════════════
// aiBot.js — Yapay Zeka Bot Sistemi
// Easy / Normal / Hard / Insane zorluk seviyeleri
// ═══════════════════════════════════════════
'use strict';

const AIBot = (() => {
  // ─── Zorluk Konfigürasyonu ───
  const CONFIGS = {
    easy: {
      label: '😊 Kolay',
      desc: 'Bot rastgele kısa kelimeler seçer. Sıklıkla hata yapar.',
      delayRange: [2500, 4500],
      maxWordLen: 5,
      mistakeRate: 0.2,     // %20 sıra geçme
      algorithm: 'random_short',
    },
    normal: {
      label: '🎯 Normal',
      desc: 'Bot ortalama uzunlukta kelimeler seçer. Bazen takılır.',
      delayRange: [1500, 3000],
      maxWordLen: 8,
      mistakeRate: 0.07,
      algorithm: 'random',
    },
    hard: {
      label: '🔥 Zor',
      desc: 'Bot uzun ve zorlu kelimeler seçer. Nadiren hata yapar.',
      delayRange: [800, 1800],
      maxWordLen: Infinity,
      mistakeRate: 0.02,
      algorithm: 'longest_random',
    },
    insane: {
      label: '💀 Delice',
      desc: 'Bot her zaman en uzun kelimeyi seçer. Neredeyse yenilmez.',
      delayRange: [400, 900],
      maxWordLen: Infinity,
      mistakeRate: 0,
      algorithm: 'longest',
    },
  };

  let _currentDifficulty = 'easy';

  // ─── Kelime Seçme Algoritmaları ───
  const algorithms = {
    random_short(lastChar, usedWords) {
      return WordValidator.getRandomWordStartingWith(lastChar, usedWords, 5);
    },
    random(lastChar, usedWords) {
      return WordValidator.getRandomWordStartingWith(lastChar, usedWords);
    },
    longest_random(lastChar, usedWords) {
      const candidates = WordValidator.getWordsStartingWith(lastChar, usedWords)
        .sort((a, b) => b.length - a.length)
        .slice(0, 5); // En uzun 5'ten rastgele seç
      return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
    },
    longest(lastChar, usedWords) {
      return WordValidator.getLongestWordStartingWith(lastChar, usedWords);
    },
  };

  // ─── Bot Hamle Hesapla ───
  function pickWord(lastChar, usedWords, difficulty = _currentDifficulty) {
    const cfg = CONFIGS[difficulty] || CONFIGS.normal;

    // Hata yapma şansı (sıra geçer)
    if (Math.random() < cfg.mistakeRate) return null;

    const algo = algorithms[cfg.algorithm] || algorithms.random;
    return algo(lastChar, usedWords);
  }

  // ─── Asenkron Bot Oyun ───
  function play(player, gameCtx, onResult) {
    const { currentWord, usedWords, difficulty } = gameCtx;
    const lastChar = currentWord.slice(-1).toLowerCase();
    const cfg = CONFIGS[difficulty || _currentDifficulty] || CONFIGS.normal;
    const [minDelay, maxDelay] = cfg.delayRange;
    const delay = minDelay + Math.random() * (maxDelay - minDelay);

    const timer = setTimeout(() => {
      const word = pickWord(lastChar, usedWords, difficulty || _currentDifficulty);
      onResult({ word, player, timeout: !word });
    }, delay);

    return timer; // Dışarıdan iptal edilebilmesi için timer ID döner
  }

  // ─── Bot Player Factory ───
  function createBot(name, avatar, difficulty = 'normal') {
    return {
      id: 'bot_' + Math.random().toString(36).substr(2, 6),
      name: name || 'Bot',
      avatar: avatar || '🤖',
      isBot: true,
      botDifficulty: difficulty,
      score: 0,
      lives: 3,
      eliminated: false,
      comboStreak: 0,
    };
  }

  // ─── Bots for Matchmaking ───
  const BOT_NAMES   = ['KelimeKralı', 'SözUstası', 'TürkçeBil', 'HarfAvcısı', 'ZincirMaster'];
  const BOT_AVATARS = ['🐺', '🦁', '🐯', '🐻', '🦝'];

  function createBots(count, difficulty = 'normal') {
    return Array.from({ length: count }, (_, i) => createBot(
      BOT_NAMES[i % BOT_NAMES.length],
      BOT_AVATARS[i % BOT_AVATARS.length],
      difficulty
    ));
  }

  return {
    CONFIGS,
    get difficulty() { return _currentDifficulty; },
    set difficulty(v) { _currentDifficulty = CONFIGS[v] ? v : 'normal'; },
    pickWord,
    play,
    createBot,
    createBots,
  };
})();

window.AIBot = AIBot;
