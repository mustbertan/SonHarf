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

  // Biyografi
  const bioEl = document.getElementById('profile-bio');
  if (bioEl) bioEl.textContent = user.bio || 'Henüz bir biyografi eklenmemiş.';

  // Popülerlik puanı
  const popEl = document.getElementById('profile-popularity');
  if (popEl) popEl.textContent = '⭐ ' + fmtNum(user.popularity || 0) + ' Popülerlik';

  // Alınan hediyeler showcase
  const showcase = document.getElementById('profile-gifts-showcase');
  if (showcase) {
    const received = (user.receivedGifts || []).slice(-12);
    showcase.innerHTML = received.length
      ? received.map(g => `<div style="font-size:1.1rem;" title="${escapeHtml(g.name)}">${g.icon}</div>`).join('')
      : `<div style="font-size:.33rem;color:var(--muted);">Henüz hediye alınmadı</div>`;
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
    // Temel (coin ile)
    { id:'av_dragon',  icon:'🐉', name:'Ejderha',         desc:'Güçlü ve korkutucu',            price:200,  currency:'coins', type:'avatar' },
    { id:'av_robot',   icon:'🦾', name:'Siborg',           desc:'Geleceğin savaşçısı',            price:300,  currency:'coins', type:'avatar' },
    { id:'av_wizard',  icon:'🧙', name:'Büyücü',           desc:'Kelime sihirbazı',               price:250,  currency:'coins', type:'avatar' },
    { id:'av_ninja',   icon:'🥷', name:'Ninja',            desc:'Sessiz ve ölümcül',              price:200,  currency:'coins', type:'avatar' },
    { id:'av_alien',   icon:'👽', name:'Uzaylı',           desc:'Bu dünyadan değil',              price:350,  currency:'coins', type:'avatar' },
    // Premium (gem ile)
    { id:'av_crown',   icon:'👑', name:'Kral / Kraliçe',   desc:'Tüm zamanların şampiyonu',       price:10,   currency:'gems',  type:'avatar', isNew:true },
    { id:'av_demon',   icon:'😈', name:'Şeytan',           desc:'Karanlığın efendisi',            price:15,   currency:'gems',  type:'avatar' },
    { id:'av_angel',   icon:'😇', name:'Melek',            desc:'Işığın koruyucusu',              price:12,   currency:'gems',  type:'avatar' },
    { id:'av_fire',    icon:'🔥', name:'Ateş Tanrısı',     desc:'Efsanevi ateş gücü',             price:20,   currency:'gems',  type:'avatar' },
    { id:'av_ice',     icon:'🧊', name:'Buz Kraliçesi',    desc:'Soğuk ve hesaplı',               price:20,   currency:'gems',  type:'avatar' },
    { id:'av_ghost',   icon:'👻', name:'Hayalet',          desc:'Görünmez güç',                   price:25,   currency:'gems',  type:'avatar' },
    { id:'av_samurai', icon:'⚔️', name:'Samurai',          desc:'Onur ve güç',                    price:30,   currency:'gems',  type:'avatar' },
    // Ultra Elite
    { id:'av_galaxy',  icon:'🌌', name:'Galaksi Efendisi', desc:'Evrenin hakimi — ultra nadir',   price:100,  currency:'gems',  type:'avatar', isNew:true },
    { id:'av_rainbow', icon:'🌈', name:'Gökkuşağı',        desc:'Renklerin ustası — çok nadir',   price:75,   currency:'gems',  type:'avatar' },
    { id:'av_legend',  icon:'🏅', name:'Efsane',           desc:'En elit unvan — benzersiz',      price:200,  currency:'gems',  type:'avatar', isNew:true },
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
      ${item.desc ? `<div style="font-size:.28rem;color:var(--muted);margin-bottom:.1rem;line-height:1.3;">${item.desc}</div>` : ''}
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

/* ═══════════════════════════════════════════
   BİYOGRAFİ SİSTEMİ
═══════════════════════════════════════════ */
function editBio() {
  const user = UserState.get();
  if (!user) return;
  const newBio = prompt('Biyografini yaz (max 120 karakter):', user.bio || '');
  if (newBio === null) return;
  const trimmed = newBio.trim().slice(0, 120);
  user.bio = trimmed;
  UserState.save();
  const bioEl = document.getElementById('profile-bio');
  if (bioEl) bioEl.textContent = trimmed || 'Henüz bir biyografi eklenmemiş.';
  haptic.success();
  showToast('✅ Biyografi güncellendi!');
}
window.editBio = editBio;

/* ═══════════════════════════════════════════
   OYUNCU PROFİLİ GÖRÜNTÜLEME
═══════════════════════════════════════════ */
let _viewingPlayer = null;

function viewPlayerProfile(playerData) {
  _viewingPlayer = playerData;
  const rank = getRank(playerData.totalScore || playerData.score || 0);
  const user = UserState.get();

  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('pp-avatar',     playerData.avatar || '👤');
  set('pp-username',   playerData.name || playerData.username || 'Oyuncu');
  set('pp-level',      playerData.level || 1);
  set('pp-score',      fmtNum(playerData.totalScore || playerData.score || 0));
  set('pp-matches',    playerData.totalMatches || 0);
  set('pp-wins',       playerData.wins || 0);
  set('pp-bio',        playerData.bio || 'Henüz biyografi yok.');
  set('pp-popularity', '⭐ ' + fmtNum(playerData.popularity || 0) + ' Popülerlik');

  const rankEl = document.getElementById('pp-rank');
  if (rankEl) { rankEl.className = 'rank-badge ' + rank.cls; rankEl.textContent = rank.emoji + ' ' + rank.label; }

  const likeBtn = document.getElementById('pp-like-btn');
  if (likeBtn) likeBtn.classList.toggle('liked', (user?.likedPlayers || []).includes(playerData.id));

  const showcase = document.getElementById('pp-gifts-showcase');
  if (showcase) {
    const gifts = (playerData.receivedGifts || []).slice(-12);
    showcase.innerHTML = gifts.length
      ? gifts.map(g => `<div style="font-size:1.1rem;" title="${escapeHtml(g.name)}">${g.icon}</div>`).join('')
      : `<div style="font-size:.33rem;color:var(--muted);">Henüz hediye yok</div>`;
  }

  Router.navigate('screen-player-profile');
}

function likePlayerProfile() {
  const user = UserState.get();
  if (!user || !_viewingPlayer) return;
  user.likedPlayers = user.likedPlayers || [];
  const id      = _viewingPlayer.id;
  const already = user.likedPlayers.includes(id);
  if (already) {
    user.likedPlayers = user.likedPlayers.filter(x => x !== id);
    showToast('Beğeni kaldırıldı');
  } else {
    user.likedPlayers.push(id);
    showToast('❤️ Profil beğenildi!');
    haptic.success();
  }
  UserState.save();
  const btn = document.getElementById('pp-like-btn');
  if (btn) btn.classList.toggle('liked', !already);
}

function addFriendFromProfile() {
  if (!_viewingPlayer) return;
  if (window.FriendsSystem) {
    FriendsSystem.sendRequest(_viewingPlayer.id, _viewingPlayer.name || _viewingPlayer.username, _viewingPlayer.avatar);
  }
}

function openGiftForPlayer() {
  if (_viewingPlayer && window.openGiftSendFor) openGiftSendFor(_viewingPlayer);
}

window.viewPlayerProfile   = viewPlayerProfile;
window.likePlayerProfile   = likePlayerProfile;
window.addFriendFromProfile= addFriendFromProfile;
window.openGiftForPlayer   = openGiftForPlayer;
window._viewingPlayer      = _viewingPlayer;

/* ═══════════════════════════════════════════
   HEDİYE SİSTEMİ
═══════════════════════════════════════════ */
const GIFT_CATALOG = [
  { id:'g_heart',   icon:'❤️',  name:'Kalp',          rarity:'common',    price:1,   popularity:3   },
  { id:'g_rose',    icon:'🌹',  name:'Gül',            rarity:'common',    price:2,   popularity:5   },
  { id:'g_coffee',  icon:'☕',  name:'Kahve',          rarity:'common',    price:2,   popularity:4   },
  { id:'g_star',    icon:'⭐',  name:'Yıldız',         rarity:'common',    price:3,   popularity:7   },
  { id:'g_cake',    icon:'🎂',  name:'Pasta',          rarity:'common',    price:5,   popularity:10  },
  { id:'g_gem_s',   icon:'💎',  name:'Küçük Gem',      rarity:'common',    price:3,   popularity:8   },
  { id:'g_trophy',  icon:'🏆',  name:'Kupa',           rarity:'rare',      price:8,   popularity:20  },
  { id:'g_crown',   icon:'👑',  name:'Taç',            rarity:'rare',      price:10,  popularity:25  },
  { id:'g_fire',    icon:'🔥',  name:'Ateş',           rarity:'rare',      price:7,   popularity:18  },
  { id:'g_rocket',  icon:'🚀',  name:'Roket',          rarity:'rare',      price:12,  popularity:30  },
  { id:'g_magic',   icon:'🪄',  name:'Sihir',          rarity:'rare',      price:10,  popularity:22  },
  { id:'g_diamond', icon:'💠',  name:'Elmas',          rarity:'rare',      price:15,  popularity:35  },
  { id:'g_dragon',  icon:'🐉',  name:'Ejderha',        rarity:'epic',      price:30,  popularity:75  },
  { id:'g_unicorn', icon:'🦄',  name:'Unicorn',        rarity:'epic',      price:25,  popularity:60  },
  { id:'g_galaxy',  icon:'🌌',  name:'Galaksi',        rarity:'epic',      price:35,  popularity:80  },
  { id:'g_thunder', icon:'⚡',  name:'Yıldırım',       rarity:'epic',      price:20,  popularity:50  },
  { id:'g_rainbow', icon:'🌈',  name:'Gökkuşağı',      rarity:'legendary', price:100, popularity:250 },
  { id:'g_king',    icon:'🤴',  name:'Kral',           rarity:'legendary', price:80,  popularity:200 },
  { id:'g_phoenix', icon:'🦅',  name:'Anka Kuşu',      rarity:'legendary', price:150, popularity:400 },
];

let _giftTab       = 'send';
let _pendingGift   = null;
let _giftRecipient = null;

function switchGiftTab(tab) {
  _giftTab = tab;
  document.querySelectorAll('#gifts-tabs .tab').forEach(t => t.classList.remove('active'));
  if (event?.target) event.target.classList.add('active');
  renderGiftsContent(tab);
}

function renderGiftsContent(tab = 'send') {
  const container = document.getElementById('gifts-content');
  const user      = UserState.get();
  if (!container || !user) return;
  const gemsEl = document.getElementById('gifts-gems');
  if (gemsEl) gemsEl.textContent = '💎 ' + (user.gems || 0);

  if (tab === 'send') {
    const rarityOrder = { common:0, rare:1, epic:2, legendary:3 };
    const sorted = [...GIFT_CATALOG].sort((a,b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]);
    container.innerHTML = `
      <div style="font-size:.33rem;color:var(--muted);margin:.17rem 0 .33rem;font-weight:700;">
        Arkadaşlarına hediye gönder ve Popülerlik Puanı kazan!
      </div>
      <div class="gift-grid">${sorted.map(g => `
        <div class="gift-card ${g.rarity}" onclick="openGiftSendFor(null,'${g.id}')">
          <div class="gift-rarity">${{ common:'Sıradan', rare:'Nadir', epic:'Epik', legendary:'Efsanevi' }[g.rarity]}</div>
          <div class="gift-icon">${g.icon}</div>
          <div class="gift-name">${g.name}</div>
          <div class="gift-price">💎 ${g.price}</div>
          <div style="font-size:.26rem;color:var(--muted);">+${g.popularity} ⭐</div>
        </div>`).join('')}
      </div>`;
    return;
  }

  if (tab === 'received') {
    const received = (user.receivedGifts || []).slice().reverse();
    container.innerHTML = received.length
      ? received.map(g => `
          <div class="friend-row" style="margin-bottom:.22rem;">
            <div style="font-size:1.2rem;">${g.icon}</div>
            <div class="friend-info">
              <div class="friend-name">${g.name}</div>
              <div class="friend-status">💌 ${escapeHtml(g.from || 'Anonim')} tarafından</div>
            </div>
            <div style="font-size:.28rem;color:var(--muted);">${g.time || ''}</div>
          </div>`).join('')
      : `<div style="text-align:center;padding:2rem;color:var(--muted);">
           <div style="font-size:2rem;margin-bottom:.44rem;">📬</div>
           <div style="font-size:.44rem;font-weight:800;">Henüz hediye almadın</div>
         </div>`;
    return;
  }

  if (tab === 'sent') {
    const sent = (user.sentGifts || []).slice().reverse();
    container.innerHTML = sent.length
      ? sent.map(g => `
          <div class="friend-row" style="margin-bottom:.22rem;">
            <div style="font-size:1.2rem;">${g.icon}</div>
            <div class="friend-info">
              <div class="friend-name">${g.name}</div>
              <div class="friend-status">📤 ${escapeHtml(g.to || '?')} kişisine</div>
            </div>
            <div style="font-size:.28rem;color:var(--muted);">${g.time || ''}</div>
          </div>`).join('')
      : `<div style="text-align:center;padding:2rem;color:var(--muted);">
           <div style="font-size:2rem;margin-bottom:.44rem;">📤</div>
           <div style="font-size:.44rem;font-weight:800;">Henüz hediye göndermedin</div>
         </div>`;
  }
}

function openGiftSendFor(playerData, giftId) {
  if (playerData) _giftRecipient = playerData;
  if (giftId) {
    _pendingGift = GIFT_CATALOG.find(g => g.id === giftId);
    if (_pendingGift) {
      const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
      el('gift-selected-icon',  _pendingGift.icon);
      el('gift-selected-name',  _pendingGift.name);
      el('gift-selected-price', `💎 ${_pendingGift.price} · +${_pendingGift.popularity} ⭐`);
    }
  }
  const inp = document.getElementById('gift-recipient-input');
  const res = document.getElementById('gift-recipient-results');
  if (inp) inp.value = _giftRecipient?.name || '';
  if (res) res.innerHTML = '';
  openModal('gift-send-modal');
}

function searchGiftRecipient(query) {
  const res = document.getElementById('gift-recipient-results');
  if (!res || !query || query.length < 2) { if (res) res.innerHTML = ''; return; }
  const found = FAKE_NAMES.filter(n => n.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 4).map((n, i) => ({ id:'gr_'+i, name:n, avatar:FAKE_AVATARS[i % FAKE_AVATARS.length] }));
  res.innerHTML = found.map(p => `
    <div class="friend-row" style="margin-bottom:.1rem;cursor:pointer;" onclick="selectGiftRecipient('${p.id}','${escapeHtml(p.name)}','${p.avatar}')">
      <div style="font-size:.6rem;">${p.avatar}</div>
      <div class="friend-info"><div class="friend-name">${escapeHtml(p.name)}</div></div>
      <div style="font-size:.28rem;color:var(--p2);">Seç</div>
    </div>`).join('');
}

function selectGiftRecipient(id, name, avatar) {
  _giftRecipient = { id, name, avatar };
  const inp = document.getElementById('gift-recipient-input');
  const res = document.getElementById('gift-recipient-results');
  if (inp) inp.value = name;
  if (res) res.innerHTML = '';
  haptic.light();
}

function confirmSendGift() {
  const user = UserState.get();
  if (!user || !_pendingGift || !_giftRecipient) { showToast('⚠️ Hediye ve alıcı seç!'); return; }
  if ((user.gems || 0) < _pendingGift.price) {
    showToast(`⚠️ Yeterli gem yok! (💎 ${_pendingGift.price} gerekli)`); haptic.error(); return;
  }
  user.gems        = (user.gems || 0) - _pendingGift.price;
  user.popularity  = (user.popularity || 0) + _pendingGift.popularity;
  user.sentGifts   = user.sentGifts || [];
  const now  = new Date();
  const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
  user.sentGifts.push({ ..._pendingGift, to: _giftRecipient.name, time });
  UserState.save();
  closeModal('gift-send-modal');
  haptic.success();
  showToast(`🎁 ${_pendingGift.icon} ${_pendingGift.name} gönderildi! (+${_pendingGift.popularity} ⭐)`);
  refreshCurrencyDisplays();
  renderGiftsContent(_giftTab);
  const popEl = document.getElementById('profile-popularity');
  if (popEl) popEl.textContent = '⭐ ' + fmtNum(user.popularity) + ' Popülerlik';
  Analytics.track('gift_sent', { gift: _pendingGift.id });
}

window.GIFT_CATALOG        = GIFT_CATALOG;
window.switchGiftTab       = switchGiftTab;
window.renderGiftsContent  = renderGiftsContent;
window.openGiftSendFor     = openGiftSendFor;
window.searchGiftRecipient = searchGiftRecipient;
window.selectGiftRecipient = selectGiftRecipient;
window.confirmSendGift     = confirmSendGift;

/* ═══════════════════════════════════════════
   KELİME ANLAM SİSTEMİ
═══════════════════════════════════════════ */
const OFFLINE_DICT_KEY = 'sonharf_offline_dict';
let _meaningCurrentWord = null;

function loadOfflineDict() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_DICT_KEY) || '{}'); } catch { return {}; }
}
function saveOfflineDict(dict) {
  try { localStorage.setItem(OFFLINE_DICT_KEY, JSON.stringify(dict)); } catch {}
}
function addToOfflineDict(word) {
  if (!word || word.length < 2) return;
  const dict   = loadOfflineDict();
  const letter = word[0].toLowerCase();
  if (!dict[letter]) dict[letter] = [];
  if (!dict[letter].includes(word)) { dict[letter].push(word); saveOfflineDict(dict); }
}

function renderWordMeaningScreen() {
  const user = UserState.get();
  if (!user) return;
  const dict     = loadOfflineDict();
  const total    = Object.values(dict).flat().length;
  const el       = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  el('dict-total-words', total);
  el('dict-verified',    user.verifiedMeanings || 0);
  el('dict-my-contrib',  user.myMeanings || 0);

  const pending = JSON.parse(localStorage.getItem('pending_votes') || '[]');
  if (pending.length > 0 && Math.random() < 0.4) _showVoteMode(pending[0]);
  else _showWriteMode();
}

function _showWriteMode() {
  const ws = document.getElementById('meaning-write-section');
  const vs = document.getElementById('meaning-vote-section');
  if (ws) ws.style.display = '';
  if (vs) vs.style.display = 'none';
  const WORD_LIST  = window.WORD_LIST || [];
  const candidates = WORD_LIST.filter(w => w.length >= 4 && w.length <= 10);
  _meaningCurrentWord = candidates.length
    ? candidates[Math.floor(Math.random() * candidates.length)] : 'kelime';
  const wordEl = document.getElementById('meaning-word-display');
  if (wordEl) wordEl.textContent = _meaningCurrentWord;
  const ta  = document.getElementById('meaning-textarea');
  const btn = document.getElementById('meaning-submit-btn');
  const ctr = document.getElementById('meaning-char-counter');
  if (ta)  ta.value = '';
  if (btn) btn.disabled = true;
  if (ctr) { ctr.textContent = '0 / 300 (min 20 karakter)'; ctr.className = 'char-counter'; }
}

function _showVoteMode(voteItem) {
  const ws = document.getElementById('meaning-write-section');
  const vs = document.getElementById('meaning-vote-section');
  if (ws) ws.style.display = 'none';
  if (vs) vs.style.display = '';
  const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  el('vote-word-display',  voteItem.word);
  el('vote-meaning-text',  voteItem.meaning);
}

function onMeaningInput(textarea) {
  const len = textarea.value.length;
  const ctr = document.getElementById('meaning-char-counter');
  const btn = document.getElementById('meaning-submit-btn');
  if (ctr) { ctr.textContent = `${len} / 300 ${len < 20 ? '(min 20 karakter)' : '✓'}`; ctr.className = 'char-counter' + (len >= 20 ? ' ok' : ''); }
  if (btn) btn.disabled = len < 20;
}

function submitWordMeaning() {
  const user = UserState.get();
  const ta   = document.getElementById('meaning-textarea');
  if (!user || !ta || !_meaningCurrentWord) return;
  const meaning = ta.value.trim();
  if (meaning.length < 20) { showToast('⚠️ En az 20 karakter yaz!'); return; }
  user.myMeanings = (user.myMeanings || 0) + 1;
  user.coins      = (user.coins || 0) + 15;
  const pending   = JSON.parse(localStorage.getItem('pending_votes') || '[]');
  pending.push({ word: _meaningCurrentWord, meaning, votes: { correct:0, wrong:0 }, submittedBy: user.id, ts: Date.now() });
  localStorage.setItem('pending_votes', JSON.stringify(pending.slice(-200)));
  UserState.save();
  haptic.success();
  showToast('📝 Açıklama gönderildi! +15 🪙');
  refreshCurrencyDisplays();
  setTimeout(() => _showWriteMode(), 500);
  Analytics.track('meaning_submitted');
}

function skipWordMeaning() { haptic.light(); _showWriteMode(); }

function voteWordMeaning(isCorrect) {
  const user   = UserState.get();
  if (!user) return;
  user.coins   = (user.coins || 0) + (isCorrect ? 5 : 2);
  UserState.save();
  haptic.success();
  showToast(isCorrect ? '✅ +5 🪙 kazandın!' : '✅ +2 🪙 kazandın!');
  refreshCurrencyDisplays();
  const pending = JSON.parse(localStorage.getItem('pending_votes') || '[]');
  if (pending[0]) {
    if (isCorrect) pending[0].votes.correct++; else pending[0].votes.wrong++;
    const total = pending[0].votes.correct + pending[0].votes.wrong;
    if (total >= 10 && pending[0].votes.correct / total >= 0.8) {
      addToOfflineDict(pending[0].word);
      if (pending[0].submittedBy === user.id) {
        user.verifiedMeanings = (user.verifiedMeanings || 0) + 1;
        user.coins = (user.coins || 0) + 50;
        UserState.save();
        showToast(`🎉 "${pending[0].word}" açıklaman doğrulandı! +50 🪙`);
        Analytics.track('meaning_verified');
      }
      pending.shift();
    }
    localStorage.setItem('pending_votes', JSON.stringify(pending));
  }
  setTimeout(() => renderWordMeaningScreen(), 400);
}

function skipVote() { haptic.light(); _showWriteMode(); }

window.loadOfflineDict      = loadOfflineDict;
window.addToOfflineDict     = addToOfflineDict;
window.renderWordMeaningScreen = renderWordMeaningScreen;
window.onMeaningInput       = onMeaningInput;
window.submitWordMeaning    = submitWordMeaning;
window.skipWordMeaning      = skipWordMeaning;
window.voteWordMeaning      = voteWordMeaning;
window.skipVote             = skipVote;

/* ═══════════════════════════════════════════
   OYUN İÇİ ARKADAŞ İSTEĞİ
═══════════════════════════════════════════ */
let _ingameFriendReqData = null;

function showIngameFriendRequest(playerData) {
  _ingameFriendReqData = playerData;
  const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  el('ifr-avatar', playerData.avatar || '👤');
  el('ifr-title',  `${playerData.name || 'Oyuncu'} Arkadaşlık İsteği Gönderdi`);
  el('ifr-name',   (playerData.name || 'Oyuncu') + ' seni arkadaş olarak eklemek istiyor');
  openModal('ingame-friend-req-modal');
  haptic.medium();
}

function acceptIngameFriendReq() {
  if (!_ingameFriendReqData) return;
  if (window.FriendsSystem) FriendsSystem.sendRequest(_ingameFriendReqData.id, _ingameFriendReqData.name, _ingameFriendReqData.avatar);
  closeModal('ingame-friend-req-modal');
  haptic.success();
  showToast(`✅ ${_ingameFriendReqData.name} arkadaş eklendi!`);
}

function rejectIngameFriendReq() {
  closeModal('ingame-friend-req-modal');
  haptic.light();
}

window.showIngameFriendRequest = showIngameFriendRequest;
window.acceptIngameFriendReq   = acceptIngameFriendReq;
window.rejectIngameFriendReq   = rejectIngameFriendReq;
