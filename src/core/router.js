// ═══════════════════════════════════════════
// router.js — Ekran Navigasyon Yöneticisi
// ═══════════════════════════════════════════
'use strict';

const Router = (() => {
  const SCREEN_CONFIG = {
    'screen-onboard':       { label: 'Başlangıç',          noAd: true,  init: null },
    'screen-home':          { label: 'Ana Sayfa',           noAd: false, init: 'renderHome' },
    'screen-matchmaking':   { label: 'Eşleşme',             noAd: true,  init: null },
    'screen-room':          { label: 'Oda',                 noAd: true,  init: 'initRoom' },
    'screen-game':          { label: 'Oyun',                noAd: true,  init: null },
    'screen-result':        { label: 'Sonuç',               noAd: true,  init: null },
    'screen-leaderboard':   { label: 'Liderboard',          noAd: false, init: 'renderLeaderboard' },
    'screen-profile':       { label: 'Profil',              noAd: false, init: 'renderProfile' },
    'screen-store':         { label: 'Mağaza',              noAd: false, init: 'renderStore' },
    'screen-chat':          { label: 'Sohbet',              noAd: false, init: 'renderGlobalChat' },
    'screen-quests':        { label: 'Görevler',            noAd: false, init: 'renderQuests' },
    'screen-settings':      { label: 'Ayarlar',             noAd: true,  init: 'renderSettings' },
    'screen-tournament':    { label: 'Turnuva',             noAd: false, init: 'renderTournamentList' },
    'screen-friends':       { label: 'Arkadaşlar',          noAd: false, init: 'renderFriendsContent' },
    'screen-daily-reward':  { label: 'Günlük Ödül',         noAd: true,  init: 'renderDailyRewardScreen' },
    'screen-battlepass':    { label: 'Sezon Geçişi',        noAd: false, init: 'renderBattlePass' },
    'screen-collection':    { label: 'Koleksiyon',          noAd: false, init: 'renderCollection' },
    'screen-bot-difficulty':{ label: 'Zorluk Seç',          noAd: true,  init: 'initDifficultyScreen' },
    'screen-gifts':         { label: 'Hediyeler',            noAd: false, init: 'renderGiftsContent'  },
    'screen-player-profile':{ label: 'Oyuncu Profili',       noAd: true,  init: null                  },
    'screen-word-meaning':  { label: 'Kelime Anlamı',        noAd: false, init: 'renderWordMeaningScreen' },
  };

  // Ad banner map
  const AD_BANNERS = {
    'screen-home':        'ad-home-banner',
    'screen-leaderboard': 'ad-lb-banner',
    'screen-result':      'ad-result-banner',
  };

  let _loadingMinMs = 1200;
  let _loadingTimer = null;
  let _loadingShownAt = 0;
  let _transitionCount = 0;

  function showLoading(msg = 'Yükleniyor') {
    clearTimeout(_loadingTimer);
    const overlay = document.getElementById('loading-overlay');
    const msgEl   = document.getElementById('loading-msg-text');
    if (msgEl)   msgEl.textContent = msg;
    if (overlay) overlay.classList.add('show');
    _loadingShownAt = Date.now();
  }

  function hideLoading(fast = false) {
    const elapsed   = Date.now() - _loadingShownAt;
    const minMs     = fast ? 400 : _loadingMinMs;
    const remaining = Math.max(0, minMs - elapsed);
    clearTimeout(_loadingTimer);
    _loadingTimer = setTimeout(() => {
      document.getElementById('loading-overlay')?.classList.remove('show');
    }, remaining);
  }

  function navigate(screenId, opts = {}) {
    const cfg = SCREEN_CONFIG[screenId];
    if (!cfg) {
      Logger.warn('Router', `Unknown screen: ${screenId}`);
      return;
    }

    const { fast = false } = opts;
    showLoading(cfg.label + ' Yükleniyor');
    UIState.setScreen(screenId);

    // Haptic
    if (window.haptic) haptic.light();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Aktif ekranı değiştir
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const el = document.getElementById(screenId);
        if (el) el.classList.add('active');

        // Browser history
        if (screenId !== 'screen-home') {
          history.pushState({ screen: screenId }, '', '');
        }

        // Interstitial reklam (belirli koşullarda)
        const prev = UIState.get().prevScreen;
        if (prev && prev !== screenId && !cfg.noAd) {
          _transitionCount++;
          if (shouldShowInterstitial()) showInterstitial();
        }

        // Ekran init fonksiyonu
        if (cfg.init && window[cfg.init]) {
          try {
            // Bazı init fonksiyonları argüman alır
            if (screenId === 'screen-leaderboard') window[cfg.init]('global');
            else if (screenId === 'screen-store')  window[cfg.init]('powerups');
            else if (screenId === 'screen-quests') window[cfg.init]('daily');
            else if (screenId === 'screen-friends') { initFriendsData(); window[cfg.init](window.currentFriendsTab || 'friends'); }
            else if (screenId === 'screen-tournament') window[cfg.init](window.currentTournTab || 'daily');
            else window[cfg.init]();
          } catch (e) {
            Logger.error('Router', `Init failed for ${screenId}`, e);
          }
        }

        // Ad banner
        if (AD_BANNERS[screenId]) pushAd(AD_BANNERS[screenId]);

        // Navbar güncelle
        updateNavbar(screenId);

        hideLoading(fast);
        Analytics.track('screen_view', { screen: screenId });
      });
    });
  }

  function updateNavbar(screenId) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    // Her nav item'ın onclick'ine bakarak eşleştir
    document.querySelectorAll('.nav-item').forEach(item => {
      const onclick = item.getAttribute('onclick') || '';
      if (onclick.includes(`'${screenId}'`)) item.classList.add('active');
    });
  }

  function shouldShowInterstitial() {
    const user = UserState.get();
    if (!user) return false;
    // İlk 5 dakika reklam gösterme
    if (Date.now() - (user.joinedAt || 0) < 5 * 60 * 1000) return false;
    // Minimum 3 ekran geçişi
    if (_transitionCount < 3) return false;
    // Her 5 geçişte bir
    return _transitionCount % 5 === 0;
  }

  // Geri buton yönetimi
  window.addEventListener('popstate', (e) => {
    const active = document.querySelector('.screen.active')?.id;
    if (!active || active === 'screen-home') return;
    history.pushState({ screen: 'screen-home' }, '', '');
    if (active === 'screen-game') {
      forfeitGame();
    } else {
      navigate(UIState.get().prevScreen || 'screen-home');
    }
  });

  return {
    navigate,
    showLoading,
    hideLoading,
    config: SCREEN_CONFIG,
  };
})();

// Geriye dönük uyumluluk — eski goScreen() çağrıları çalışsın
window.goScreen = (id) => Router.navigate(id);
window.Router = Router;
