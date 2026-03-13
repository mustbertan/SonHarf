// ═══════════════════════════════════════════
// battlepass.js — Sezon / Battle Pass Sistemi
// ═══════════════════════════════════════════
'use strict';

const BattlePassSystem = (() => {
  const SEASON_LEVELS   = 50;
  const XP_PER_LEVEL    = 1000;
  const PREMIUM_COST    = 50; // gem

  const FREE_REWARDS = [
    '🪙100','⚡','🪙150','💎2','🪙200','⚡⚡','🪙250','💎3',
    '🪙300','⚡','🪙350','💎5','🪙400','⚡','🪙450','💎7',
    '🪙500','⚡⚡⚡','🪙600','💎10',
    ...Array.from({ length: 30 }, (_, i) =>
      i % 3 === 0 ? '💎5' : i % 2 === 0 ? `🪙${(i + 1) * 50}` : '⚡'),
  ];

  const PREMIUM_REWARDS = [
    '💎5','🪙200','💎8','⚡⚡','🪙500','💎15','🪙800','💎20',
    '👑Kozmetik','💎25','🪙1000','💎30','⚡⚡⚡','💎40','🪙2000','💎50',
    '👑ÖzelAvatar','💎60','🪙3000','💎80',
    ...Array.from({ length: 30 }, (_, i) =>
      i % 3 === 0 ? '💎20' : i % 2 === 0 ? `🪙${(i + 2) * 100}` : '⚡⚡'),
  ];

  let _currentTrack = 'free';

  // ─── Veri Başlatma ───
  function ensureData() {
    const user = UserState.get();
    if (!user) return;
    user.seasonLevel    = user.seasonLevel    || 1;
    user.seasonXP       = user.seasonXP       || 0;
    user.hasPremiumPass = user.hasPremiumPass || false;
    user.claimedFree    = user.claimedFree    || [];
    user.claimedPremium = user.claimedPremium || [];
  }

  // ─── XP Ekle ───
  function addXP(amount) {
    const user = UserState.get();
    if (!user) return;
    ensureData();
    user.seasonXP += amount;
    while (user.seasonXP >= XP_PER_LEVEL && user.seasonLevel < SEASON_LEVELS) {
      user.seasonXP -= XP_PER_LEVEL;
      user.seasonLevel++;
      showToast(`⭐ Sezon Seviye ${user.seasonLevel}!`);
      EventBus.emit('season:level_up', user.seasonLevel);
      Analytics.track('season_level_up', { level: user.seasonLevel });
    }
    UserState.save();
  }

  // ─── Sekme ───
  function switchTrack(track) {
    _currentTrack = track;
    document.querySelectorAll('#bp-track-tabs .tab').forEach(t => t.classList.remove('active'));
    if (event?.target) event.target.classList.add('active');
    render();
  }

  // ─── Render ───
  function render() {
    const user = UserState.get();
    if (!user) return;
    ensureData();

    // XP bar
    const xpPct = Math.min(100, (user.seasonXP / XP_PER_LEVEL) * 100);
    const lvlEl = document.getElementById('season-level-display');
    const barEl = document.getElementById('season-xp-bar');
    const txtEl = document.getElementById('season-xp-text');
    const nxtEl = document.getElementById('season-xp-needed');
    const dateEl= document.getElementById('season-end-date');

    if (lvlEl)  lvlEl.textContent  = user.seasonLevel;
    if (barEl)  barEl.style.width  = xpPct + '%';
    if (txtEl)  txtEl.textContent  = `${user.seasonXP} XP`;
    if (nxtEl)  nxtEl.textContent  = `${XP_PER_LEVEL - user.seasonXP} XP sonraki seviye`;

    const endDate = new Date(Date.now() + 30 * 86_400_000);
    const months  = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
    if (dateEl) dateEl.textContent = `Biter: ${endDate.getDate()} ${months[endDate.getMonth()]}`;

    // Premium banner
    const banner = document.getElementById('bp-premium-banner');
    if (banner) banner.style.display = user.hasPremiumPass ? 'none' : '';

    // Tier container
    const container = document.getElementById('bp-tiers-container');
    if (!container) return;

    const rewards   = _currentTrack === 'free' ? FREE_REWARDS : PREMIUM_REWARDS;
    const claimed   = _currentTrack === 'free' ? user.claimedFree : user.claimedPremium;
    const isPremium = _currentTrack === 'premium';

    container.innerHTML = rewards.slice(0, SEASON_LEVELS).map((r, i) => {
      const lvl       = i + 1;
      const unlocked  = user.seasonLevel > lvl;
      const available = user.seasonLevel === lvl;
      const isClaimed = claimed.includes(lvl);
      const canClaim  = (available || unlocked) && !isClaimed && (!isPremium || user.hasPremiumPass);

      const baseCls = isPremium ? 'bp-reward-premium' : 'bp-reward-free';
      const stateCls= isClaimed ? 'claimed' : (unlocked || available) ? 'unlocked' : '';
      const label   = r.replace(/\d+/g, '').replace(/[^🪙💎⚡👑⭐]/g, '').slice(0, 2) || r.slice(0, 2);

      return `<div class="bp-tier">
        <div class="bp-tier-level">Sv${lvl}</div>
        <div class="${baseCls} ${stateCls}"
             onclick="BattlePassSystem.claimReward(${lvl},'${_currentTrack}')"
             title="${r}" style="cursor:${canClaim ? 'pointer' : 'default'};">
          <span>${label}</span>
          ${isClaimed ? '<div class="bp-claimed-check">✓</div>' : ''}
          ${isPremium && !user.hasPremiumPass ? '<div class="premium-lock">🔒</div>' : ''}
        </div>
      </div>`;
    }).join('');
  }

  // ─── Ödül Al ───
  function claimReward(level, track) {
    const user = UserState.get();
    if (!user) return;
    ensureData();

    if (track === 'premium' && !user.hasPremiumPass) {
      showToast('👑 Premium geçiş gerekli!'); return;
    }

    const claimed = track === 'free' ? user.claimedFree : user.claimedPremium;
    if (claimed.includes(level)) { showToast('✅ Zaten alındı!'); return; }
    if (user.seasonLevel < level) { showToast('⏳ Bu seviyeye ulaşmadın!'); return; }

    claimed.push(level);
    const rewards = track === 'free' ? FREE_REWARDS : PREMIUM_REWARDS;
    const r = rewards[level - 1] || '';

    const coinMatch = r.match(/🪙(\d+)/); if (coinMatch) { user.coins = (user.coins||0) + parseInt(coinMatch[1]); }
    const gemMatch  = r.match(/💎(\d+)/); if (gemMatch)  { user.gems  = (user.gems ||0) + parseInt(gemMatch[1]);  }
    const powerCount = (r.match(/⚡/g) || []).length;
    if (powerCount > 0) {
      user.powerups = user.powerups || {};
      const POWERUP_DEFS = window.POWERUP_DEFS || [];
      POWERUP_DEFS.forEach(p => { user.powerups[p.id] = (user.powerups[p.id] || 0) + powerCount; });
    }

    UserState.save();
    haptic.success();
    showToast(`🎁 Seviye ${level} ödülü alındı!`);
    refreshCurrencyDisplays();
    render();
    Analytics.track('bp_claim', { level, track });
  }

  // ─── Premium Satın Al ───
  function buyPremium() {
    const user = UserState.get();
    if (!user) return;
    ensureData();
    if (user.hasPremiumPass) { showToast('👑 Zaten Premium geçişin var!'); return; }
    if ((user.gems || 0) < PREMIUM_COST) {
      showToast(`⚠️ Yeterli gem yok! (${PREMIUM_COST} 💎 gerekli)`); return;
    }
    user.gems -= PREMIUM_COST;
    user.hasPremiumPass = true;
    UserState.save();
    haptic.success();
    showToast('👑 Premium Geçiş aktif! Tüm ödüller açıldı.');
    render();
    refreshCurrencyDisplays();
    Analytics.track('bp_premium_buy');
  }

  return { ensureData, addXP, switchTrack, render, claimReward, buyPremium };
})();

// Global bağlantılar
window.BattlePassSystem = BattlePassSystem;
window.addSeasonXP      = (xp) => BattlePassSystem.addXP(xp);
window.renderBattlePass = () => BattlePassSystem.render();
window.switchBpTrack    = (t) => BattlePassSystem.switchTrack(t);
window.claimBpReward    = (l, t) => BattlePassSystem.claimReward(l, t);
window.buyPremiumPass   = () => BattlePassSystem.buyPremium();
