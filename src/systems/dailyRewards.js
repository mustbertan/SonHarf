// ═══════════════════════════════════════════
// dailyRewards.js — Günlük Giriş Ödülleri
// 7 günlük döngü, streak, bonus ödüller
// ═══════════════════════════════════════════
'use strict';

const DailyRewardSystem = (() => {
  const REWARDS = [
    { day: 1, icon: '🪙', label: '+50',    apply: u => { u.coins = (u.coins||0) + 50; } },
    { day: 2, icon: '🪙', label: '+100',   apply: u => { u.coins = (u.coins||0) + 100; } },
    { day: 3, icon: '⚡', label: 'x2 Güç', apply: u => {
      const DEFS = window.POWERUP_DEFS || [];
      u.powerups = u.powerups || {};
      DEFS.forEach(p => { u.powerups[p.id] = (u.powerups[p.id]||0) + 2; });
    }},
    { day: 4, icon: '🪙', label: '+150',   apply: u => { u.coins = (u.coins||0) + 150; } },
    { day: 5, icon: '💎', label: '+5',     apply: u => { u.gems  = (u.gems ||0) + 5; } },
    { day: 6, icon: '⚡', label: 'Paket',  apply: u => {
      const DEFS = window.POWERUP_DEFS || [];
      u.powerups = u.powerups || {};
      DEFS.forEach(p => { u.powerups[p.id] = (u.powerups[p.id]||0) + 1; });
    }},
    { day: 7, icon: '💎', label: '+10',    apply: u => { u.gems = (u.gems||0) + 10; u.coins = (u.coins||0) + 200; } },
  ];

  // Streak milestones
  const STREAK_BONUSES = [
    { streak:  3, icon: '🪙', label: '+50 Coin Bonus',  apply: u => { u.coins = (u.coins||0) + 50; } },
    { streak:  7, icon: '💎', label: '+5 Gem Bonus',    apply: u => { u.gems  = (u.gems ||0) + 5;  } },
    { streak: 14, icon: '⚡', label: 'Güç Paketi',      apply: u => {
      const DEFS = window.POWERUP_DEFS || [];
      u.powerups = u.powerups || {};
      DEFS.forEach(p => { u.powerups[p.id] = (u.powerups[p.id]||0) + 2; });
    }},
    { streak: 30, icon: '👑', label: 'Özel Avatar',     apply: u => {
      u.inventory = u.inventory || [];
      if (!u.inventory.includes('av_crown')) u.inventory.push('av_crown');
    }},
  ];

  // ─── Giriş Kontrolü ───
  function checkAndShow() {
    const user = UserState.get();
    if (!user) return;

    const today = new Date().toDateString();
    if (user.lastLoginDate === today) return; // Bugün zaten kontrol edildi

    // Streak güncelle
    const yesterday = new Date(Date.now() - 86_400_000).toDateString();
    if (user.lastLoginDate === yesterday) {
      user.loginStreak = (user.loginStreak || 0) + 1;
    } else {
      user.loginStreak = 1; // Seri sıfırla
    }
    user.lastLoginDate = today;
    UserState.save();

    // Popup göster
    _showPopup();
  }

  function _showPopup() {
    const user    = UserState.get();
    const dayIdx  = ((user.loginStreak - 1) % 7);
    const reward  = REWARDS[dayIdx];

    const iconEl = document.getElementById('popup-reward-icon');
    const valEl  = document.getElementById('popup-reward-val');
    const dayEl  = document.getElementById('popup-reward-day');
    const strkEl = document.getElementById('popup-streak');

    if (iconEl) iconEl.textContent = reward.icon;
    if (valEl)  valEl.textContent  = reward.label;
    if (dayEl)  dayEl.textContent  = `${reward.day}. Gün Ödülü (Gün ${user.loginStreak})`;
    if (strkEl) strkEl.textContent = user.loginStreak;

    // Ödülü uygula
    reward.apply(user);

    // Streak bonusu var mı?
    const bonus = STREAK_BONUSES.find(b => b.streak === user.loginStreak);
    if (bonus) {
      bonus.apply(user);
      setTimeout(() => showToast(`🎉 ${user.loginStreak} Gün Serisi! ${bonus.icon} ${bonus.label}`), 2000);
    }

    UserState.save();
    refreshCurrencyDisplays();
    openModal('daily-reward-popup');
    haptic.success();
    Analytics.track('daily_reward_claimed', { streak: user.loginStreak, day: reward.day });
  }

  // ─── Ekran Render ───
  function renderScreen() {
    const user = UserState.get();
    if (!user) return;

    const streak  = user.loginStreak || 0;
    const today   = new Date().toDateString();
    const claimed = user.lastLoginDate === today;

    const strkEl = document.getElementById('daily-streak-count');
    const nextEl = document.getElementById('daily-next-claim');
    const btnEl  = document.getElementById('daily-claim-btn');

    if (strkEl) strkEl.textContent = streak;
    if (nextEl) nextEl.textContent = claimed ? '✅ Yarın yeni ödül!' : '🎁 Bugün ödülünü al!';
    if (btnEl)  {
      btnEl.disabled    = claimed;
      btnEl.textContent = claimed ? '✅ Bugün alındı' : '🎁 Bugünkü Ödülü Al';
    }

    const grid    = document.getElementById('daily-reward-grid');
    if (!grid) return;
    const dayIdx  = Math.max(0, ((streak - 1) % 7));

    grid.innerHTML = REWARDS.map((r, i) => {
      let cls = 'locked';
      if (i < dayIdx)                         cls = 'claimed';
      else if (i === dayIdx && claimed)        cls = 'claimed';
      else if (i === dayIdx)                   cls = 'today';

      return `<div class="day-reward ${cls}">
        <div class="day-num">${r.day}. Gün</div>
        <div class="day-icon">${r.icon}</div>
        <div class="day-val">${r.label}</div>
        ${cls === 'claimed' ? '<div style="position:absolute;top:.1rem;right:.1rem;font-size:.28rem;">✓</div>' : ''}
      </div>`;
    }).join('');
  }

  // ─── Manuel Talep (buton) ───
  function claim() {
    const user = UserState.get();
    const today = new Date().toDateString();
    if (user?.lastLoginDate === today) {
      showToast('✅ Bugünkü ödülü zaten aldın!'); return;
    }
    checkAndShow();
    renderScreen();
  }

  return { checkAndShow, renderScreen, claim, REWARDS, STREAK_BONUSES };
})();

// Global bağlantılar
window.DailyRewardSystem      = DailyRewardSystem;
window.checkAndShowDailyReward= () => DailyRewardSystem.checkAndShow();
window.renderDailyRewardScreen= () => DailyRewardSystem.renderScreen();
window.claimDailyReward       = () => DailyRewardSystem.claim();
