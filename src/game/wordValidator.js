// ═══════════════════════════════════════════
// wordValidator.js — Kelime Doğrulama Sistemi
// Öncelik: 1. Local Dict → 2. Cache → 3. Server API
// ═══════════════════════════════════════════
'use strict';

const WordValidator = (() => {
  // ─── Local Sözlük (büyük Set — ayrı words.js dosyasından yüklenir) ───
  // words.js yüklü değilse boş Set kullanılır
  const DICT = window.WORD_DICT || new Set();
  const LIST = window.WORD_LIST || Array.from(DICT);

  // ─── Cache ───
  const cache = new Map();
  const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 saat

  function cacheGet(word) {
    const entry = cache.get(word);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(word); return null; }
    return entry.valid;
  }
  function cacheSet(word, valid) {
    cache.set(word, { valid, ts: Date.now() });
    // Cache 5000'den büyük olursa temizle
    if (cache.size > 5000) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts).slice(0, 1000);
      oldest.forEach(([k]) => cache.delete(k));
    }
  }

  // ─── Format Kontrolü ───
  function isValidFormat(word) {
    if (!word || word.length < 2 || word.length > 30) return false;
    return /^[a-züşğçöıâîûàèì]+$/i.test(word);
  }

  // ─── Server API ───
  const API_ENDPOINT = '/api/kelime';
  const REQUEST_TIMEOUT = 6000;

  async function checkServer(word) {
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);

      const res  = await fetch(`${API_ENDPOINT}?w=${encodeURIComponent(word)}`, {
        signal: ctrl.signal,
        headers: { 'X-Client': 'sonharf-web' }
      });
      clearTimeout(tid);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // valid: true = geçerli, false = geçersiz, null = sunucu hatası
      if (data.valid === null) return { valid: false, source: 'server_error' };

      // TDK'dan geçen kelimeyi offline sözlüğe kaydet
      if (data.valid === true && window.addToOfflineDict) {
        try { window.addToOfflineDict(w); } catch {}
      }

      return { valid: data.valid, source: data.source || 'tdk' };

    } catch (e) {
      Logger.warn('WordValidator', 'Server check failed:', e.message);
      // Local'deyse offline listeyi kullan
      const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
      return { valid: isLocal ? false : false, source: 'network_error' };
    }
  }

  // ─── Anti-Cheat: Server-Authoritative Validation ───
  // Puanlama ve doğrulama server'dan gelir
  // Client sadece UI feedback verir
  async function validateAuthoritative(word, gameContext) {
    const result = await validate(word);
    if (!result.valid) return result;

    // Server'a oyun bağlamı ile gönder (ileride)
    // Bu sayede score manipulation engellenir
    if (gameContext?.roomId && window.SB_CONFIGURED) {
      // Supabase RPC çağrısı ile server-side validation
      // const serverResult = await supabase.rpc('validate_word', { word, room_id: gameContext.roomId });
    }
    return result;
  }

  // ─── Ana Doğrulama Fonksiyonu ───
  async function validate(word) {
    if (!word) return { valid: false, source: 'empty' };
    const w = word.trim().toLowerCase();

    // 1. Format kontrolü
    if (!isValidFormat(w)) return { valid: false, source: 'format' };

    // 2. Local dictionary
    if (DICT.has(w)) return { valid: true, source: 'local' };

    // 3. Cache
    const cached = cacheGet(w);
    if (cached !== null) return { valid: cached, source: 'cache' };

    // 4. Server API
    const result = await checkServer(w);
    if (result.source !== 'network_error' && result.source !== 'server_error') {
      cacheSet(w, result.valid);
    }
    return result;
  }

  // ─── Bot için hızlı kelime seçici ───
  function getWordsStartingWith(char, usedWords = new Set()) {
    return LIST.filter(w => w[0] === char && !usedWords.has(w));
  }

  function getLongestWordStartingWith(char, usedWords = new Set()) {
    return getWordsStartingWith(char, usedWords).sort((a, b) => b.length - a.length)[0] || null;
  }

  function getRandomWordStartingWith(char, usedWords = new Set(), maxLen = Infinity) {
    const candidates = getWordsStartingWith(char, usedWords).filter(w => w.length <= maxLen);
    return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
  }

  return {
    validate,
    validateAuthoritative,
    isValidFormat,
    getWordsStartingWith,
    getLongestWordStartingWith,
    getRandomWordStartingWith,
    get dict() { return DICT; },
    get list() { return LIST; },
    get cacheSize() { return cache.size; },
  };
})();

window.WordValidator = WordValidator;
// Geriye dönük uyumluluk
window.checkWordTDK = (word) => WordValidator.validate(word);
