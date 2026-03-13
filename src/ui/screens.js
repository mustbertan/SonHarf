// ═══════════════════════════════════════════
// screens.js — Ekran Render Fonksiyonları
// Her ekranın UI mantığı burada
// ═══════════════════════════════════════════
'use strict';

/* ─── Sabitler ─── */
const AVATARS    = ['🦊','🐺','🦁','🐯','🐻','🦝','🐼','🦋','🦄','🐲','👾','🤖'];
const COUNTRIES  = [{ name:'Türkiye', flag:'🇹🇷', code:'TR' }];
const FAKE_NAMES = ['KelimeKralı','SözUstası','TürkçeBil','HarfAvcısı','ZincirMaster','SözcükNinja','YıldızHarf','Semantik','KelimeBey','Linguist'];
const FAKE_AVATARS = ['🐺','🦁','🐯','🐻','🦝','🐼','🦋','🐲','👾','🤖'];

const RANKS = [
  { id:'bronze',   label:'Bronz',   emoji:'🥉', min:0,     cls:'rank-bronze'   },
  { id:'silver',   label:'Gümüş',   emoji:'🥈', min:500,   cls:'rank-silver'   },
  { id:'gold',     label:'Altın',   emoji:'🥇', min:1500,  cls:'rank-gold'     },
  { id:'platinum', label:'Platin',  emoji:'💎', min:3500,  cls:'rank-platinum' },
  { id:'diamond',  label:'Elmas',   emoji:'💠', min:7000,  cls:'rank-diamond'  },
  { id:'master',   label:'Usta',    emoji:'👑', min:12000, cls:'rank-master'   },
];

function getRank(score) {
  let rank = RANKS[0];
  for (const r of RANKS) { if (score >= r.min) rank = r; }
  return rank;
}

/* ─── Fake Players (Leaderboard simülasyonu) ─── */
function getFakePlayers(n = 10) {
  const user = UserState.get();
  const me   = {
    name: user?.username || 'Ben',
    avatar: user?.avatar || '🦊',
    score: user?.totalScore || 0,
    country: user?.countryFlag || '🇹🇷',
    isMe: true,
  };
  const others = Array.from({ length: n }, (_, i) => ({
    name:    FAKE_NAMES[i % FAKE_NAMES.length],
    avatar:  FAKE_AVATARS[i % FAKE_AVATARS.length],
    score:   Math.floor(Math.random() * 5000 + 200),
    country: '🇹🇷',
  }));
  return [me, ...others].sort((a, b) => b.score - a.score);
}

/* ═══ ONBOARD ═══ */
let selectedAvatar  = '🦊';
let selectedCountry = 'TR';

function renderOnboard() {
  const ag = document.getElementById('avatar-grid');
  if (ag) {
    ag.innerHTML = AVATARS.map(a =>
      `<div class="avatar-opt ${a === selectedAvatar ? 'selected' : ''}" onclick="selectAvatar('${a}')">${a}</div>`
    ).join('');
  }
}

function selectAvatar(a) {
  selectedAvatar = a;
  document.querySelectorAll('.avatar-opt').forEach(el => el.classList.remove('selected'));
  event?.target?.closest('.avatar-opt')?.classList.add('selected');
  haptic.light();
}

function completeOnboard() {
  const input = document.getElementById('onboard-username');
  const username = (input?.value || '').trim();
  if (!username)        { haptic.error(); showToast('⚠️ Kullanıcı adı gir!'); return; }
  if (username.length < 2) { haptic.error(); showToast('⚠️ En az 2 karakter!'); return; }

  const country = COUNTRIES[0];
  const user = UserState.create({
    username,
    avatar:      selectedAvatar,
    country:     country.code,
    countryName: country.name,
    countryFlag: country.flag,
  });

  // Supabase'e kaydet
  if (SupabaseService.isConfigured) SupabaseService.upsertUser(user).catch(() => {});

  haptic.success();
  Analytics.track('onboard_complete');
  Router.navigate('screen-home');
}

/* ═══ HOME ═══ */
function renderHome() {
  const user = UserState.get();
  if (!user) return;
  const rank = getRank(user.totalScore);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const setClass = (id, cls) => { const el = document.getElementById(id); if (el) el.className = cls; };

  document.getElementById('home-avatar')?.setAttribute && (document.getElementById('home-avatar').textContent = user.avatar);
  set('home-username', user.username);
  setClass('home-rank', 'rank-badge ' + rank.cls);
  set('home-rank',   rank.emoji + ' ' + rank.label);
  set('home-coins',  '🪙 ' + fmtNum(user.coins));
  set('home-gems',   '💎 ' + user.gems);
  set('home-wins',   fmtNum(user.wins));
  set('home-matches',fmtNum(user.totalMatches));
  set('home-score',  fmtNum(user.totalScore));
  set('home-streak', user.bestStreak || 0);

  // Özellik kartları
  set('home-streak-label',     user.loginStreak ? `🔥 ${user.loginStreak} günlük seri` : 'Seriyi koru!');
  set('home-season-label',     user.seasonLevel ? `Sv. ${user.seasonLevel} · Sezon 1` : 'Sv. 1');
  set('home-collection-label', `${(user.wordCollection || []).length} kelime`);

  // Quest preview
  const qp = document.getElementById('home-quests-preview');
  if (qp) {
    const quests = getDailyQuests().slice(0, 2);
    qp.innerHTML = quests.map(q => {
      const cur = q.current();
      const pct = Math.min(100, (cur / q.max) * 100);
      return `<div class="quest-card" style="margin-bottom:.17rem;">
        <div class="quest-header">
          <div class="quest-icon">${q.icon}</div>
          <div class="quest-info">
            <div class="quest-title">${q.title}</div>
            <div class="quest-sub">${cur}/${q.max}</div>
          </div>
          <div class="quest-reward">+${q.reward} ${q.rewardType === 'coins' ? '🪙' : '💎'}</div>
        </div>
        <div class="prog-bar"><div class="prog-fill gold" style="width:${pct}%"></div></div>
      </div>`;
    }).join('');
  }

  renderLbPreview();
}

function renderLbPreview() {
  const preview = document.getElementById('home-lb-preview');
  if (!preview) return;
  const players = getFakePlayers(5);
  const medals  = ['🥇','🥈','🥉'];
  preview.innerHTML = players.slice(0, 3).map((p, i) =>
    `<div class="lb-row ${['top1','top2','top3'][i]}" style="margin-bottom:.17rem;">
      <div class="lb-rank">${medals[i]}</div>
      <div class="lb-avatar">${p.avatar}</div>
      <div class="lb-info"><div class="lb-name">${escapeHtml(p.name)}</div></div>
      <div class="lb-score">${fmtNum(p.score)}</div>
    </div>`
  ).join('');
}

/* ═══ LEADERBOARD ═══ */
let currentLbTab = 'global';

function switchLbTab(tab) {
  currentLbTab = tab;
  document.querySelectorAll('#lb-tabs .tab').forEach(t => t.classList.remove('active'));
  event?.target?.classList.add('active');
  renderLeaderboard(tab);
}

function renderLeaderboard(tab = 'global') {
  const list   = document.getElementById('lb-list');
  if (!list) return;
  const players = getFakePlayers(20);
  const medals  = ['🥇','🥈','🥉'];

  list.innerHTML = players.map((p, i) => {
    const rankCls     = i < 3 ? `top${i + 1}` : (p.isMe ? 'me' : '');
    const rankDisplay = i < 3 ? medals[i] : (i + 1);
    return `<div class="lb-row ${rankCls}">
      <div class="lb-rank">${rankDisplay}</div>
      <div class="lb-avatar">${p.avatar}</div>
      <div class="lb-info">
        <div class="lb-name">${escapeHtml(p.name)} ${p.isMe ? '<span style="font-size:.28rem;color:var(--p2);">(Sen)</span>' : ''}</div>
        <div class="lb-sub">${p.country}</div>
      </div>
      <div class="lb-score">${fmtNum(p.score)}</div>
    </div>`;
  }).join('');
}

/* ═══ PROFILE ═══ */
function renderProfile() {
  const user = UserState.get();
  if (!user) return;
  const rank = getRank(user.totalScore);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('profile-avatar-big', user.avatar);
  set('profile-username',   user.username);
  set('profile-level',      user.level);
  set('profile-coins',      '🪙 ' + fmtNum(user.coins));
  set('profile-gems',       '💎 ' + user.gems);
  set('profile-country',    user.countryName || 'Türkiye');

  const rb = document.getElementById('profile-rank-badge');
  if (rb) { rb.className = 'rank-badge ' + rank.cls; rb.textContent = rank.emoji + ' ' + rank.label; }

  const pct = Math.min(100, ((user.xp || 0) / (user.xpNeeded || 100)) * 100);
  set('profile-xp-text', `${user.xp || 0} / ${user.xpNeeded || 100}`);
  const xpBar = document.getElementById('profile-xp-bar');
  if (xpBar) xpBar.style.width = pct + '%';

  set('p-total',   user.totalMatches || 0);
  set('p-wins',    user.wins || 0);
  set('p-winrate', user.totalMatches > 0 ? Math.round((user.wins / user.totalMatches) * 100) + '%' : '0%');
  set('p-words',   user.totalWords || 0);
  set('p-score',   fmtNum(user.totalScore));
  set('p-streak',  user.bestStreak || 0);

  // Achievements
  const ach = document.getElementById('profile-achievements');
  if (ach) {
    ach.innerHTML = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.22rem;">` +
      ACHIEVEMENTS.map(a => {
        const earned = (user.achievements || []).includes(a.id);
        return `<div class="store-card" style="opacity:${earned ? 1 : .35};" title="${a.desc}">
          <div class="store-card-icon">${a.icon}</div>
          <div style="font-size:.3rem;font-weight:700;color:var(--muted);line-height:1.1;">${a.name}</div>
        </div>`;
      }).join('') + `</div>`;
  }

  // Inventory powerups
  const inv = document.getElementById('profile-inventory');
  if (inv) {
    const pu = user.powerups || {};
    inv.innerHTML = `<div style="display:flex;gap:.22rem;flex-wrap:wrap;">` +
      POWERUP_DEFS.map(p =>
        `<div style="display:flex;align-items:center;gap:.12rem;background:var(--card);border:1.5px solid var(--border);border-radius:.38rem;padding:.17rem .33rem;">
          <span style="font-size:.5rem;">${p.icon}</span>
          <span style="font-size:.36rem;font-weight:800;color:var(--text);">×${pu[p.id] || 0}</span>
        </div>`
      ).join('') + `</div>`;
  }
}

/* ═══ STORE ═══ */
const POWERUP_DEFS = [
  { id:'extra_time', icon:'⏰', label:'Ekstra',  desc:'Ekstra Süre (+15sn)',     price:80  },
  { id:'hint',       icon:'💡', label:'İpucu',   desc:'İlk harfi göster',        price:60  },
  { id:'shield',     icon:'🛡️', label:'Kalkan',  desc:'1 hatalı kelimeyi koru', price:100 },
  { id:'pass',       icon:'⏭️', label:'Pas',     desc:'Sırayı geç',              price:50  },
  { id:'double',     icon:'2️⃣', label:'Çift',   desc:'Bu tur puanı 2x',         price:120 },
];

const STORE_ITEMS = {
  powerups: [
    { id:'pack_extra_time_3', icon:'⏰', name:'3x Ekstra Süre', price:200, currency:'coins', type:'powerup', puId:'extra_time', qty:3 },
    { id:'pack_hint_3',       icon:'💡', name:'3x İpucu',       price:150, currency:'coins', type:'powerup', puId:'hint',       qty:3 },
    { id:'pack_shield_2',     icon:'🛡️', name:'2x Kalkan',      price:180, currency:'coins', type:'powerup', puId:'shield',     qty:2 },
    { id:'pack_pass_5',       icon:'⏭️', name:'5x Pas',         price:220, currency:'coins', type:'powerup', puId:'pass',       qty:5 },
    { id:'pack_double_2',     icon:'2️⃣', name:'2x Çift Puan',  price:250, currency:'coins', type:'powerup', puId:'double',     qty:2 },
    { id:'powerup_bundle',    icon:'⚡', name:'Güç Paketi',     price:15,  currency:'gems',  type:'bundle',  isNew:true },
  ],
  avatars: [
    { id:'av_dragon', icon:'🐉', name:'Ejderha',       price:200, currency:'coins', type:'avatar' },
    { id:'av_robot',  icon:'🦾', name:'Siborg',        price:300, currency:'coins', type:'avatar' },
    { id:'av_wizard', icon:'🧙', name:'Büyücü',        price:250, currency:'coins', type:'avatar' },
    { id:'av_ninja',  icon:'🥷', name:'Ninja',         price:200, currency:'coins', type:'avatar' },
    { id:'av_alien',  icon:'👽', name:'Uzaylı',        price:350, currency:'coins', type:'avatar' },
    { id:'av_crown',  icon:'👑', name:'Kral / Kraliçe',price:10,  currency:'gems',  type:'avatar', isNew:true },
  ],
  coins: [
    { id:'coins_100',  icon:'🪙', name:'100 Coin',  price:1,   currency:'gems', type:'currency', coins:100  },
    { id:'coins_300',  icon:'🪙', name:'300 Coin',  price:2,   currency:'gems', type:'currency', coins:300  },
    { id:'coins_1000', icon:'🪙', name:'1000 Coin', price:5,   currency:'gems', type:'currency', coins:1000 },
    { id:'gems_10',    icon:'💎', name:'10 Gem',    price:0.99,currency:'real', type:'currency', gems:10    },
    { id:'gems_50',    icon:'💎', name:'50 Gem',    price:3.99,currency:'real', type:'currency', gems:50    },
    { id:'gems_200',   icon:'💎', name:'200 Gem',   price:9.99,currency:'real', type:'currency', gems:200, isNew:true },
  ],
  cosmetics: [
    { id:'theme_dark',  icon:'🌙', name:'Karanlık Tema', price:5,   currency:'gems',  type:'cosmetic' },
    { id:'theme_fire',  icon:'🔥', name:'Ateş Teması',   price:8,   currency:'gems',  type:'cosmetic' },
    { id:'effect_star', icon:'⭐', name:'Yıldız Efekti', price:300, currency:'coins', type:'cosmetic' },
    { id:'frame_gold',  icon:'🖼️', name:'Altın Çerçeve', price:10,  currency:'gems',  type:'cosmetic' },
  ],
};

let currentStoreTab = 'powerups';
let pendingBuyItem  = null;

function switchStoreTab(tab) {
  currentStoreTab = tab;
  document.querySelectorAll('#screen-store .tab').forEach(t => t.classList.remove('active'));
  event?.target?.classList.add('active');
  renderStore(tab);
}

function renderStore(tab = 'powerups') {
  const user  = UserState.get();
  const grid  = document.getElementById('store-grid');
  if (!grid) return;
  const items = STORE_ITEMS[tab] || [];

  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  el('store-coins', '🪙 ' + fmtNum(user?.coins || 0));
  el('store-gems',  '💎 ' + (user?.gems || 0));

  grid.innerHTML = items.map(item => {
    const owned    = _isOwned(item);
    const priceStr = item.currency === 'coins' ? `🪙 ${item.price}`
                   : item.currency === 'gems'  ? `💎 ${item.price}`
                   : `₺${item.price}`;
    return `<div class="store-card ${owned ? 'owned' : ''}" onclick="openBuyModal('${item.id}')">
      ${item.isNew ? `<div class="store-new-badge">YENİ</div>` : ''}
      <div class="store-card-icon">${item.icon}</div>
      <div class="store-card-name">${item.name}</div>
      ${owned
        ? `<div class="store-card-owned">✓ Sahip</div>`
        : `<div class="store-card-price">${priceStr}</div>`}
    </div>`;
  }).join('');
}

function _isOwned(item) {
  const user = UserState.get();
  if (!user) return false;
  if (item.type === 'avatar' || item.type === 'cosmetic') {
    return (user.inventory || []).includes(item.id);
  }
  return false;
}

function openBuyModal(itemId) {
  const allItems = Object.values(STORE_ITEMS).flat();
  const item     = allItems.find(i => i.id === itemId);
  if (!item) return;
  if (_isOwned(item)) { showToast('✓ Zaten sahipsin!'); return; }
  haptic.light();

  pendingBuyItem = item;
  const priceStr = item.currency === 'coins' ? `🪙 ${item.price}`
                 : item.currency === 'gems'  ? `💎 ${item.price}`
                 : `₺${item.price}`;

  document.getElementById('store-confirm-title').textContent = item.name;
  document.getElementById('store-confirm-icon').textContent  = item.icon;
  document.getElementById('store-confirm-price').textContent = priceStr;
  openModal('store-confirm-modal');
}

function confirmBuy() {
  const item = pendingBuyItem;
  const user = UserState.get();
  if (!item || !user) return;

  if (item.currency === 'coins') {
    if ((user.coins || 0) < item.price) { haptic.error(); showToast('⚠️ Yeterli coin yok!'); closeModal('store-confirm-modal'); return; }
    user.coins -= item.price;
  } else if (item.currency === 'gems') {
    if ((user.gems || 0) < item.price) { haptic.error(); showToast('⚠️ Yeterli gem yok!'); closeModal('store-confirm-modal'); return; }
    user.gems -= item.price;
  } else if (item.currency === 'real') {
    showToast('💳 Gerçek para ödemesi yakında!'); closeModal('store-confirm-modal'); return;
  }

  if (item.type === 'powerup') {
    user.powerups = user.powerups || {};
    user.powerups[item.puId] = (user.powerups[item.puId] || 0) + item.qty;
  } else if (item.type === 'avatar' || item.type === 'cosmetic') {
    user.inventory = user.inventory || [];
    if (!user.inventory.includes(item.id)) user.inventory.push(item.id);
  } else if (item.type === 'bundle') {
    user.powerups = user.powerups || {};
    POWERUP_DEFS.forEach(p => { user.powerups[p.id] = (user.powerups[p.id] || 0) + 2; });
  } else if (item.type === 'currency') {
    if (item.coins) user.coins = (user.coins || 0) + item.coins;
    if (item.gems)  user.gems  = (user.gems  || 0) + item.gems;
  }

  UserState.save();
  haptic.success();
  showToast('✅ Satın alındı!');
  closeModal('store-confirm-modal');
  renderStore(currentStoreTab);
  refreshCurrencyDisplays();
  Analytics.track('store_purchase', { item: item.id, price: item.price, currency: item.currency });
}

/* ═══ QUESTS ═══ */
function getDailyQuests() {
  const user = UserState.get();
  return [
    { id:'dq1', icon:'⚔️', title:'3 Maç Oyna',      reward:100, rewardType:'coins', current:() => Math.min(user?.todayMatches || 0, 3),  max:3  },
    { id:'dq2', icon:'🏆', title:'1 Maç Kazan',     reward:150, rewardType:'coins', current:() => Math.min(user?.todayWins    || 0, 1),  max:1  },
    { id:'dq3', icon:'📝', title:'20 Kelime Gönder', reward:80,  rewardType:'coins', current:() => Math.min(user?.todayWords   || 0, 20), max:20 },
  ];
}
function getWeeklyQuests() {
  const user = UserState.get();
  return [
    { id:'wq1', icon:'🎮', title:'15 Maç Oyna', reward:500, rewardType:'coins', current:() => Math.min(user?.weekMatches  || 0, 15), max:15 },
    { id:'wq2', icon:'🏆', title:'5 Maç Kazan', reward:750, rewardType:'coins', current:() => Math.min(user?.weekWins     || 0, 5),  max:5  },
    { id:'wq3', icon:'⚡', title:'Güç Kullan',   reward:3,   rewardType:'gems',  current:() => Math.min(user?.powerupsUsed || 0, 1),  max:1  },
  ];
}

let currentQuestTab = 'daily';
function switchQuestTab(tab) {
  currentQuestTab = tab;
  document.querySelectorAll('#screen-quests .tab').forEach(t => t.classList.remove('active'));
  event?.target?.classList.add('active');
  renderQuests(tab);
}

function renderQuests(tab = 'daily') {
  const list = document.getElementById('quests-list');
  if (!list) return;
  const user = UserState.get();

  if (tab === 'achievements') {
    list.innerHTML = ACHIEVEMENTS.map(a => {
      const earned = (user?.achievements || []).includes(a.id);
      return `<div class="quest-card" style="opacity:${earned ? 1 : .6};">
        <div class="quest-header">
          <div class="quest-icon">${a.icon}</div>
          <div class="quest-info"><div class="quest-title">${a.name}</div><div class="quest-sub">${a.desc}</div></div>
          <div class="quest-reward ${earned ? 'quest-complete' : ''}">${earned ? '✅' : '🔒'}</div>
        </div>
      </div>`;
    }).join('');
    return;
  }

  const quests = tab === 'daily' ? getDailyQuests() : getWeeklyQuests();
  list.innerHTML = quests.map(q => {
    const cur  = q.current();
    const pct  = Math.min(100, (cur / q.max) * 100);
    const done = cur >= q.max;
    return `<div class="quest-card">
      <div class="quest-header">
        <div class="quest-icon">${q.icon}</div>
        <div class="quest-info"><div class="quest-title">${q.title}</div><div class="quest-sub">${cur}/${q.max}</div></div>
        <div class="quest-reward ${done ? 'quest-complete' : ''}">
          ${done ? '✅' : `+${q.reward} ${q.rewardType === 'coins' ? '🪙' : '💎'}`}
        </div>
      </div>
      <div class="prog-bar"><div class="prog-fill gold" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}

/* ═══ SETTINGS ═══ */
function renderSettings() {
  const user     = UserState.get();
  const settings = UIState.get().settings;
  if (!user) return;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('settings-avatar',   user.avatar);
  set('settings-username', user.username);
  const countryEl = document.getElementById('settings-country');
  if (countryEl) countryEl.textContent = (user.countryName || 'Türkiye') + ' ' + (user.countryFlag || '🇹🇷');

  ['sfx','music','hapticEnabled'].forEach(k => {
    const domKey = k === 'hapticEnabled' ? 'haptic' : k;
    const el = document.getElementById('toggle-' + domKey);
    if (el) el.classList.toggle('on', !!settings[k]);
  });
  const ts = document.getElementById('settings-timer');
  if (ts) ts.value = settings.defaultTimer || 15;
}

function toggleSetting(k) {
  UIState.updateSetting(k, !UIState.get().settings[k]);
  renderSettings();
  haptic.light();
}

function saveSettingVal(k, v) {
  UIState.updateSetting(k, isNaN(v) ? v : Number(v));
}

function editUsername() {
  const user = UserState.get();
  const name = prompt('Yeni kullanıcı adın:', user?.username || '');
  if (!name?.trim()) return;
  if (name.trim().length < 2) { showToast('⚠️ En az 2 karakter!'); return; }
  UserState.update({ username: name.trim().slice(0, 16) });
  showToast('✅ Kullanıcı adı güncellendi!');
  renderSettings();
}

function resetData() {
  if (!confirm('Tüm verileri sıfırlamak istediğinden emin misin?')) return;
  UserState.reset();
  UIState.updateSetting('sfx', true);
  UIState.updateSetting('music', true);
  UIState.updateSetting('hapticEnabled', true);
  UIState.updateSetting('defaultTimer', 15);
  location.reload();
}

/* ═══ GLOBAL CHAT ═══ */
const CHAT_MESSAGES = [
  { name:'KelimeKralı', avatar:'🐺', text:'Merhaba herkese! 👋', time:'10:32' },
  { name:'SözUstası',   avatar:'🦁', text:'Kim oynamak ister?',  time:'10:33' },
  { name:'TürkçeBil',   avatar:'🐯', text:'Yeni rekor kırdım! 🎉',time:'10:35' },
];

function renderGlobalChat() {
  const msgs = document.getElementById('global-chat-messages');
  if (!msgs) return;
  const user = UserState.get();
  msgs.innerHTML = CHAT_MESSAGES.map(m => {
    const isMe = user && m.name === user.username;
    return `<div class="chat-bubble ${isMe ? 'mine' : ''}">
      <div class="chat-avatar">${m.avatar}</div>
      <div class="chat-msg">
        ${!isMe ? `<div class="chat-name">${escapeHtml(m.name)}</div>` : ''}
        <div class="chat-text">${escapeHtml(m.text)}</div>
        <div class="chat-time">${m.time}</div>
      </div>
    </div>`;
  }).join('');
  msgs.scrollTop = msgs.scrollHeight;
}

function sendGlobalChat() {
  const input = document.getElementById('global-chat-input');
  const text  = input?.value.trim();
  const user  = UserState.get();
  if (!text || !user) return;
  if (text.length > 150) { showToast('⚠️ Mesaj çok uzun!'); return; }

  const filtered = filterProfanity(text);
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
  CHAT_MESSAGES.push({ name: user.username, avatar: user.avatar, text: filtered, time });
  UserState.update({ chatMessages: (user.chatMessages || 0) + 1 });
  if (input) input.value = '';
  renderGlobalChat();
  haptic.light();
  checkAchievements();
}

/* ═══ REWARDED AD ═══ */
function showRewardedAd() {
  haptic.light();
  openModal('rewarded-ad-modal');
}

function claimRewardedAd(type) {
  const user = UserState.get();
  if (!user) return;
  haptic.success();
  closeModal('rewarded-ad-modal');

  setTimeout(() => {
    if (type === 'coins') {
      UserState.addCoins(50);
      showToast('🪙 +50 Coin kazandın!');
    } else if (type === 'powerup') {
      const rnd = POWERUP_DEFS[Math.floor(Math.random() * POWERUP_DEFS.length)];
      user.powerups = user.powerups || {};
      user.powerups[rnd.id] = (user.powerups[rnd.id] || 0) + 1;
      UserState.save();
      showToast(`${rnd.icon} ${rnd.desc} kazandın!`);
    } else if (type === 'gems') {
      UserState.addGems(5);
      showToast('💎 +5 Gem kazandın!');
    } else if (type === 'chest') {
      const r = Math.random();
      if      (r < .4) { UserState.addCoins(100); showToast('📦 Sandık: 🪙 100 Coin!'); }
      else if (r < .7) { UserState.addGems(3);    showToast('📦 Sandık: 💎 3 Gem!'); }
      else             {
        const p = POWERUP_DEFS[Math.floor(Math.random() * POWERUP_DEFS.length)];
        user.powerups = user.powerups || {};
        user.powerups[p.id] = (user.powerups[p.id] || 0) + 1;
        UserState.save();
        showToast(`📦 Sandık: ${p.icon} ${p.desc}!`);
      }
    }
    refreshCurrencyDisplays();
  }, 200);
}

/* ═══ BOT DIFFICULTY SCREEN ═══ */
function initDifficultyScreen() {
  selectDifficulty(window.selectedDifficulty || 'easy');
}

/* ═══ SOSYAL PAYLAŞIM ═══ */
let lastGameStats = null;

function openShareModal() {
  const stats = lastGameStats || { score:0, words:0, result:'🎮', streak:0 };
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('share-score-val',  fmtNum(stats.score));
  set('share-words-val',  stats.words);
  set('share-result-val', stats.result);
  set('share-streak-val', stats.streak);
  openModal('share-modal');
  haptic.light();
}

function _buildShareText() {
  const s = lastGameStats || { score:0, words:0, result:'🎮', streak:0 };
  return `SonHarf'da ${s.result === '🏆' ? 'kazandım' : 'oynadım'}! 🔤\n⭐ ${fmtNum(s.score)} Puan | 📝 ${s.words} Kelime | 🔥 ${s.streak} Seri\nSen de oyna: https://sonharf.app`;
}

function shareToWhatsApp() {
  window.open(`https://wa.me/?text=${encodeURIComponent(_buildShareText())}`, '_blank');
  haptic.success();
  Analytics.track('share', { platform: 'whatsapp' });
}
function shareToTwitter() {
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(_buildShareText())}`, '_blank');
  haptic.success();
  Analytics.track('share', { platform: 'twitter' });
}
function shareToInstagram() {
  copyShareLink();
  showToast('📋 Metin kopyalandı! Instagram\'a yapıştır.');
}
function copyShareLink() {
  navigator.clipboard?.writeText(_buildShareText()).then(() => {
    showToast('📋 Kopyalandı!');
    haptic.success();
  }).catch(() => showToast('Kopyalanamadı'));
}

// Global export
window.AVATARS         = AVATARS;
window.FAKE_NAMES      = FAKE_NAMES;
window.FAKE_AVATARS    = FAKE_AVATARS;
window.RANKS           = RANKS;
window.POWERUP_DEFS    = POWERUP_DEFS;
window.STORE_ITEMS     = STORE_ITEMS;
window.getRank         = getRank;
window.getFakePlayers  = getFakePlayers;
window.renderOnboard   = renderOnboard;
window.selectAvatar    = selectAvatar;
window.completeOnboard = completeOnboard;
window.renderHome      = renderHome;
window.renderLbPreview = renderLbPreview;
window.switchLbTab     = switchLbTab;
window.renderLeaderboard= renderLeaderboard;
window.renderProfile   = renderProfile;
window.renderStore     = renderStore;
window.switchStoreTab  = switchStoreTab;
window.openBuyModal    = openBuyModal;
window.confirmBuy      = confirmBuy;
window.getDailyQuests  = getDailyQuests;
window.getWeeklyQuests = getWeeklyQuests;
window.renderQuests    = renderQuests;
window.switchQuestTab  = switchQuestTab;
window.renderSettings  = renderSettings;
window.toggleSetting   = toggleSetting;
window.saveSettingVal  = saveSettingVal;
window.editUsername    = editUsername;
window.resetData       = resetData;
window.renderGlobalChat= renderGlobalChat;
window.sendGlobalChat  = sendGlobalChat;
window.showRewardedAd  = showRewardedAd;
window.claimRewardedAd = claimRewardedAd;
window.initDifficultyScreen = initDifficultyScreen;
window.openShareModal  = openShareModal;
window.shareToWhatsApp = shareToWhatsApp;
window.shareToTwitter  = shareToTwitter;
window.shareToInstagram= shareToInstagram;
window.copyShareLink   = copyShareLink;
window.lastGameStats   = lastGameStats;
