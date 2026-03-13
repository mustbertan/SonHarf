// ═══════════════════════════════════════════
// app.js — Ana Uygulama, Haptic, Toast, Modal, Utilities
// ═══════════════════════════════════════════
'use strict';

/* ─── Haptic Feedback ─── */
const haptic = {
  _ok()     { return UIState.get().settings.hapticEnabled && 'vibrate' in navigator; },
  light()   { if (this._ok()) navigator.vibrate(8); },
  medium()  { if (this._ok()) navigator.vibrate(22); },
  heavy()   { if (this._ok()) navigator.vibrate(50); },
  success() { if (this._ok()) navigator.vibrate([12, 60, 20]); },
  error()   { if (this._ok()) navigator.vibrate([30, 40, 30]); },
};
window.haptic = haptic;

/* ─── Toast ─── */
let _toastTimer = null;
function showToast(msg, dur = 2500) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), dur);
}
window.showToast = showToast;

/* ─── Modals ─── */
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  UIState.openModal(id);
  haptic.light();
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  UIState.closeModal(id);
}
window.openModal  = openModal;
window.closeModal = closeModal;

/* ─── Interstitial Ad ─── */
let _adPushed = {};
let _interstitialTimer = null;

function pushAd(key) {
  if (_adPushed[key]) return;
  _adPushed[key] = true;
  try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
}
window.pushAd = pushAd;

function showInterstitial() {
  const ov = document.getElementById('interstitial-overlay');
  if (!ov) return;
  pushAd('interstitial');
  ov.classList.add('open');

  const closeBtn  = document.getElementById('interstitial-close');
  const countdown = document.getElementById('interstitial-countdown');
  if (closeBtn)  closeBtn.classList.add('disabled');
  if (countdown) countdown.textContent = '5';

  let sec = 5;
  clearInterval(_interstitialTimer);
  _interstitialTimer = setInterval(() => {
    sec--;
    if (countdown) countdown.textContent = sec;
    if (sec <= 0) {
      clearInterval(_interstitialTimer);
      if (closeBtn)  closeBtn.classList.remove('disabled');
      if (countdown) countdown.textContent = '';
    }
  }, 1000);
}
function closeInterstitial() {
  document.getElementById('interstitial-overlay')?.classList.remove('open');
  clearInterval(_interstitialTimer);
}
window.showInterstitial  = showInterstitial;
window.closeInterstitial = closeInterstitial;

/* ─── Achievement Popup ─── */
let _achTimer = null;
function showAchievementPopup(icon, name) {
  const popup  = document.getElementById('achievement-popup');
  const iconEl = document.getElementById('ach-icon');
  const nameEl = document.getElementById('ach-name');
  if (!popup) return;
  if (iconEl) iconEl.textContent = icon;
  if (nameEl) nameEl.textContent = name;
  popup.classList.add('show');
  clearTimeout(_achTimer);
  _achTimer = setTimeout(() => popup.classList.remove('show'), 3500);
  haptic.success();
}
window.showAchievementPopup = showAchievementPopup;

/* ─── Utilities ─── */
function fmtNum(n) {
  if (!n && n !== 0) return '0';
  n = Number(n);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function formatTimeLeft(ms) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 24) return `${Math.floor(h / 24)} gün`;
  if (h > 0)  return `${h}s ${m}d`;
  return `${m} dakika`;
}
function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}
window.fmtNum       = fmtNum;
window.escapeHtml   = escapeHtml;
window.formatTimeLeft = formatTimeLeft;
window.randomItem   = randomItem;
window.debounce     = debounce;

/* ─── Currency Display Refresh ─── */
function refreshCurrencyDisplays() {
  const user = UserState.get();
  if (!user) return;
  const coin = '🪙 ' + fmtNum(user.coins);
  const gem  = '💎 ' + user.gems;
  ['home-coins', 'store-coins', 'profile-coins'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = coin;
  });
  ['home-gems', 'store-gems', 'profile-gems'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = gem;
  });
}
window.refreshCurrencyDisplays = refreshCurrencyDisplays;

/* ─── Achievements Check ─── */
const ACHIEVEMENTS = [
  { id:'first_win',   icon:'🏆', name:'İlk Zafer',      desc:'İlk maçını kazan',    req: u => u.wins >= 1 },
  { id:'words_50',    icon:'📝', name:'Kelime Ustası',   desc:'50 kelime gönder',    req: u => u.totalWords >= 50 },
  { id:'words_200',   icon:'📚', name:'Kelime Dehası',   desc:'200 kelime gönder',   req: u => u.totalWords >= 200 },
  { id:'wins_10',     icon:'🎯', name:'On Şerit',        desc:'10 maç kazan',        req: u => u.wins >= 10 },
  { id:'matches_20',  icon:'🎮', name:'Deneyimli',       desc:'20 maç oyna',         req: u => u.totalMatches >= 20 },
  { id:'streak_5',    icon:'🔥', name:'Ateşli Seri',     desc:'5 kelime serisi yap', req: u => u.bestStreak >= 5 },
  { id:'powerup_use', icon:'⚡', name:'Güç Kullanıcısı', desc:'İlk gücü kullan',     req: u => (u.powerupsUsed || 0) >= 1 },
  { id:'level_5',     icon:'⬆️', name:'Deneyimli',       desc:"Seviye 5'e ulaş",    req: u => u.level >= 5 },
  { id:'score_1000',  icon:'💯', name:'Bin Puan',        desc:'1000 toplam puan',    req: u => u.totalScore >= 1000 },
  { id:'chat_first',  icon:'💬', name:'Sosyal Kelebek',  desc:'İlk mesajını gönder', req: u => (u.chatMessages || 0) >= 1 },
];
window.ACHIEVEMENTS = ACHIEVEMENTS;

function checkAchievements() {
  const user = UserState.get();
  if (!user) return;
  user.achievements = user.achievements || [];
  let earned = false;
  ACHIEVEMENTS.forEach(a => {
    if (!user.achievements.includes(a.id) && a.req(user)) {
      user.achievements.push(a.id);
      showAchievementPopup(a.icon, a.name);
      UserState.addCoins(50);
      earned = true;
      Analytics.track('achievement_earned', { id: a.id });
    }
  });
  if (earned) UserState.save();
}
window.checkAchievements = checkAchievements;

/* ─── Profanity Filter ─── */
const PROFANITY = []; // Gerçek liste production'da sunucudan çekilir
function filterProfanity(text) {
  return PROFANITY.reduce((t, w) => t.replace(new RegExp(w, 'gi'), '***'), text);
}
window.filterProfanity = filterProfanity;

/* ─── Error Boundary ─── */
window.addEventListener('error', (e) => {
  Logger.error('Global', e.message, e.filename, e.lineno);
  Analytics.logError('uncaught', e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  Logger.error('Promise', e.reason);
  Analytics.logError('promise', String(e.reason));
});

/* ─── App Init ─── */
function initApp() {
  Perf.start('app_init');
  UIState.loadSettings();
  EventBus.emit('app:init');

  // Supabase başlat
  if (window.initSupabase) initSupabase();

  // Onboard avatarlarını render et
  if (window.renderOnboard) renderOnboard();

  const user = UserState.load();

  if (!user) {
    setTimeout(() => {
      Router.hideLoading(true);
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById('screen-onboard')?.classList.add('active');
    }, 1400);
  } else {
    history.pushState({ screen: 'screen-home' }, '', '');
    Analytics.setUser(user.id);

    setTimeout(() => {
      Router.hideLoading(true);
      Router.navigate('screen-home', { fast: true });
      pushAd('ad-home-banner');
      checkAchievements();

      // Günlük ödül kontrolü
      setTimeout(() => {
        if (window.checkAndShowDailyReward) checkAndShowDailyReward();
      }, 800);

      // Friend request badge
      if (window.initFriendsData) {
        initFriendsData();
        const u = UserState.get();
        const badge = document.getElementById('friend-req-badge');
        if (badge && u?.friendReqs?.length > 0) {
          badge.style.display = '';
          badge.textContent = u.friendReqs.length;
        }
      }
    }, 1400);
  }

  Perf.end('app_init');
}
window.init = initApp;
window.addEventListener('DOMContentLoaded', initApp);
