// ═══════════════════════════════════════════
// wordCollection.js — Kelime Koleksiyonu
// Nadiyet sistemi, filtreleme, istatistikler
// ═══════════════════════════════════════════
'use strict';

const WordCollectionSystem = (() => {
  const RARITY_CONFIG = {
    legendary: { label: 'Efsanevi', color: 'var(--gold)',   points: 10, minLen: 10 },
    epic:      { label: 'Epik',     color: 'var(--p2)',     points: 5,  minLen: 8  },
    rare:      { label: 'Nadir',    color: 'var(--acc3)',   points: 3,  minLen: 6  },
    common:    { label: 'Sıradan',  color: 'var(--muted)',  points: 1,  minLen: 0  },
  };

  let _currentTab = 'all';

  // ─── Nadiyet Hesapla ───
  function getRarity(word) {
    const len = word.length;
    // Uzunluğa göre deterministik nadiyet
    if (len >= 10) return 'legendary';
    if (len >= 8)  return 'epic';
    if (len >= 6)  return 'rare';
    return 'common';
  }

  // ─── Kelime Ekle ───
  function add(word) {
    if (!word || typeof word !== 'string') return;
    const w = word.trim().toLowerCase();
    if (w.length < 2) return;

    const user = UserState.get();
    if (!user) return;
    user.wordCollection = user.wordCollection || [];

    // Zaten var mı?
    if (user.wordCollection.find(e => e.word === w)) return;

    const rarity = getRarity(w);
    const cfg    = RARITY_CONFIG[rarity];
    const entry  = { word: w, rarity, points: w.length * cfg.points, addedAt: Date.now() };

    user.wordCollection.push(entry);
    UserState.save();

    // Nadir kelimede bildirim
    if (rarity === 'legendary') {
      showToast(`🌟 Efsanevi Kelime: ${w}`);
      showAchievementPopup('🌟', `Efsanevi: ${w}`);
      Analytics.track('word_legendary', { word: w });
    } else if (rarity === 'epic') {
      showToast(`💜 Epik Kelime: ${w}`);
    }

    EventBus.emit('collection:word_added', entry);
  }

  // ─── Toplu Ekle ───
  function addMany(words) {
    if (!Array.isArray(words)) return;
    words.forEach(w => { if (w) add(typeof w === 'string' ? w : w.word); });
  }

  // ─── Sekme ───
  function switchTab(tab) {
    _currentTab = tab;
    document.querySelectorAll('#collection-tabs .tab').forEach(t => t.classList.remove('active'));
    if (event?.target) event.target.classList.add('active');
    render();
  }

  // ─── Render ───
  function render() {
    const user = UserState.get();
    if (!user) return;

    const collection = user.wordCollection || [];
    const filtered   = _currentTab === 'all'
      ? collection
      : collection.filter(w => w.rarity === _currentTab);

    // İstatistikler
    _updateStats(collection);

    const grid = document.getElementById('collection-grid');
    if (!grid) return;

    if (!filtered.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:1.5rem;">
        <div style="font-size:1.5rem;margin-bottom:.33rem;">📖</div>
        <div style="font-size:.38rem;font-weight:800;color:var(--muted);">
          ${_currentTab === 'all' ? 'Koleksiyon boş' : 'Bu kategoride kelime yok'}
        </div>
        <div style="font-size:.3rem;color:var(--dim);margin-top:.17rem;">Kelime oynayarak koleksiyonunu doldur!</div>
      </div>`;
      return;
    }

    // Nadiyet sırasına göre sırala
    const ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 };
    const sorted = [...filtered].sort((a, b) =>
      ORDER[a.rarity] - ORDER[b.rarity] || b.points - a.points
    );

    grid.innerHTML = sorted.map(w => {
      const cfg = RARITY_CONFIG[w.rarity] || RARITY_CONFIG.common;
      return `<div class="word-card-collect rarity-${w.rarity}" title="${w.word} — ${cfg.label}">
        <div class="wc-word">${escapeHtml(w.word)}</div>
        <div class="wc-rarity">${cfg.label}</div>
        <div class="wc-points">+${w.points} puan</div>
      </div>`;
    }).join('');
  }

  function _updateStats(collection) {
    const counts = { legendary: 0, epic: 0, rare: 0, common: 0 };
    collection.forEach(w => { if (counts[w.rarity] !== undefined) counts[w.rarity]++; });

    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('coll-total',     collection.length);
    el('coll-legendary', counts.legendary);
    el('coll-epic',      counts.epic);
    el('coll-rare',      counts.rare);

    // Home'daki koleksiyon etiketini güncelle
    const homeLabel = document.getElementById('home-collection-label');
    if (homeLabel) homeLabel.textContent = `${collection.length} kelime`;
  }

  // ─── İstatistik Özeti ───
  function getSummary() {
    const collection = UserState.get()?.wordCollection || [];
    return {
      total:     collection.length,
      legendary: collection.filter(w => w.rarity === 'legendary').length,
      epic:      collection.filter(w => w.rarity === 'epic').length,
      rare:      collection.filter(w => w.rarity === 'rare').length,
      common:    collection.filter(w => w.rarity === 'common').length,
      points:    collection.reduce((sum, w) => sum + (w.points || 0), 0),
    };
  }

  return { getRarity, add, addMany, switchTab, render, getSummary, RARITY_CONFIG };
})();

// Global bağlantılar
window.WordCollectionSystem  = WordCollectionSystem;
window.addWordToCollection   = (word) => WordCollectionSystem.add(word);
window.switchCollectionTab   = (tab) => WordCollectionSystem.switchTab(tab);
window.renderCollection      = () => WordCollectionSystem.render();
