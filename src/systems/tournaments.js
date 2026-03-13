// ═══════════════════════════════════════════
// tournaments.js — Turnuva Sistemi
// Günlük/Haftalık turnuvalar, bracket, kayıt
// ═══════════════════════════════════════════
'use strict';

const TournamentSystem = (() => {
  // ─── Yerel Turnuva Verisi (Backend yokken) ───
  const LOCAL_TOURNAMENTS = [
    {
      id: 'daily_1', type: 'daily', name: 'Günlük Turnuva', icon: '⚡',
      status: 'open', maxPlayers: 16,
      prizes: [
        { place: '🥇 1.', reward: '🪙 500 + 💎 20' },
        { place: '🥈 2.', reward: '🪙 300 + 💎 10' },
        { place: '🥉 3.', reward: '🪙 150 + 💎 5' },
      ],
      startIn: Date.now() + 3_600_000,
    },
    {
      id: 'daily_2', type: 'daily', name: 'Hızlı Turnuva', icon: '🔥',
      status: 'live', maxPlayers: 8,
      prizes: [
        { place: '🥇 1.', reward: '🪙 300 + 💎 10' },
        { place: '🥈 2.', reward: '🪙 150' },
        { place: '🥉 3.', reward: '🪙 75' },
      ],
      startIn: 0,
    },
    {
      id: 'weekly_1', type: 'weekly', name: 'Haftalık Şampiyona', icon: '👑',
      status: 'open', maxPlayers: 64,
      prizes: [
        { place: '🥇 1.', reward: '💎 100 + 👑 Özel Avatar' },
        { place: '🥈 2.', reward: '💎 50 + 🪙 1000' },
        { place: '🥉 3.', reward: '💎 25 + 🪙 500' },
      ],
      startIn: Date.now() + 86_400_000 * 2,
    },
  ];

  let _currentTab = 'daily';
  let _pendingTournament = null;

  // ─── Turnuva Listesi Render ───
  function renderList(tab = 'daily') {
    _currentTab = tab;
    const list = document.getElementById('tournament-list');
    if (!list) return;

    if (tab === 'bracket') { renderBracket(); return; }

    const filtered = LOCAL_TOURNAMENTS.filter(t => t.type === tab);
    const user     = UserState.get();

    if (!filtered.length) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">🏆</div>
        <div class="empty-title">Turnuva bulunamadı</div>
        <div class="empty-sub">Daha sonra tekrar kontrol et</div>
      </div>`;
      return;
    }

    list.innerHTML = filtered.map(t => {
      const isReg    = (user?.tournamentIds || []).includes(t.id);
      const timeLeft = t.startIn > Date.now() ? formatTimeLeft(t.startIn - Date.now()) : '';
      const statusCls = { open: 'tourn-open', live: 'tourn-live', ended: 'tourn-ended' }[t.status] || 'tourn-open';
      const statusLbl = { open: '🟢 Kayıt Açık', live: '🔴 Canlı', ended: '⚫ Bitti' }[t.status] || '';

      return `<div class="tournament-card ${isReg ? 'active' : ''}" onclick="TournamentSystem.open('${t.id}')">
        <div style="display:flex;align-items:center;gap:.33rem;margin-bottom:.22rem;">
          <div style="font-size:1rem;">${t.icon}</div>
          <div style="flex:1;">
            <div style="font-family:'Syne',sans-serif;font-size:.44rem;font-weight:800;color:var(--text);">${t.name}</div>
            <div style="font-size:.3rem;color:var(--muted);">Max ${t.maxPlayers} oyuncu</div>
          </div>
          <span class="tourn-status-badge ${statusCls}">${statusLbl}</span>
        </div>
        ${timeLeft ? `<div style="font-size:.33rem;color:var(--muted);margin-bottom:.17rem;">⏰ <strong style="color:var(--acc2);">${timeLeft}</strong></div>` : ''}
        <div class="tournament-prize">${t.prizes.map(p => `<div class="prize-chip">${p.place}: ${p.reward}</div>`).join('')}</div>
        <div style="margin-top:.22rem;">
          ${isReg
            ? `<div style="font-size:.33rem;color:var(--acc3);font-weight:800;">✅ Kayıtlısın</div>`
            : t.status === 'open'
              ? `<button class="btn btn-primary btn-sm btn-full" style="margin-top:.1rem;">🚀 Katıl</button>`
              : t.status === 'live'
                ? `<button class="btn btn-danger btn-sm btn-full" style="margin-top:.1rem;">▶ Şimdi Oyna</button>`
                : ''}
        </div>
      </div>`;
    }).join('');
  }

  // ─── Bracket Görüntüle ───
  function renderBracket() {
    const list = document.getElementById('tournament-list');
    const user = UserState.get();
    const regId = (user?.tournamentIds || [])[0];
    const t = LOCAL_TOURNAMENTS.find(x => x.id === regId);

    if (!t) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">🏆</div>
        <div class="empty-title">Henüz kayıtlı değilsin</div>
        <div class="empty-sub">Günlük veya Haftalık sekmesinden kayıt ol</div>
      </div>`;
      return;
    }

    // Simüle edilmiş bracket oyuncuları
    const FAKE_NAMES   = window.FAKE_NAMES   || ['Bot1','Bot2','Bot3','Bot4','Bot5','Bot6','Bot7'];
    const FAKE_AVATARS = window.FAKE_AVATARS || ['🐺','🦁','🐯','🐻','🦝','🐼','🦋'];

    const allPlayers = [
      { name: user.username, avatar: user.avatar, score: user.totalScore || 0, isMe: true },
      ...FAKE_NAMES.slice(0, 7).map((n, i) => ({
        name: n, avatar: FAKE_AVATARS[i], score: Math.floor(Math.random() * 3000 + 500)
      })),
    ].sort((a, b) => b.score - a.score);

    const rounds = [
      {
        name: 'Çeyrek Final',
        matches: [
          [allPlayers[0], allPlayers[7]],
          [allPlayers[1], allPlayers[6]],
          [allPlayers[2], allPlayers[5]],
          [allPlayers[3], allPlayers[4]],
        ],
      },
      { name: 'Yarı Final', matches: [[allPlayers[0], allPlayers[1]], [allPlayers[2], allPlayers[3]]] },
      { name: 'Final',      matches: [[allPlayers[0], allPlayers[2]]] },
    ];

    list.innerHTML = `
      <div style="font-family:'Syne',sans-serif;font-size:.55rem;font-weight:800;color:var(--text);margin:.22rem 0 .33rem;">${t.name} — Bracket</div>
      ${rounds.map(round => `
        <div style="font-size:.33rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin:.22rem 0 .17rem;">${round.name}</div>
        ${round.matches.map(([p1, p2]) => `
          <div class="bracket-match">
            <div class="bracket-match-header">${round.name}</div>
            <div class="bracket-player ${p1.score >= p2.score ? 'winner' : ''}">
              <div class="bp-avatar">${p1.avatar}</div>
              <div class="bp-name">${escapeHtml(p1.name)}${p1.isMe ? ' <span style="font-size:.26rem;color:var(--p2);">(Sen)</span>' : ''}</div>
              <div class="bp-score">${fmtNum(p1.score)}</div>
            </div>
            <div class="bracket-player ${p2.score > p1.score ? 'winner' : ''}">
              <div class="bp-avatar">${p2.avatar}</div>
              <div class="bp-name">${escapeHtml(p2.name)}</div>
              <div class="bp-score">${fmtNum(p2.score)}</div>
            </div>
          </div>`).join('')}
      `).join('')}`;
  }

  // ─── Turnuva Aç (Modal) ───
  function open(id) {
    const t = LOCAL_TOURNAMENTS.find(x => x.id === id);
    if (!t) return;
    _pendingTournament = t;

    const user = UserState.get();
    if (t.status === 'live' && (user?.tournamentIds || []).includes(t.id)) {
      showToast('⚔️ Turnuva oyunu başlıyor!');
      if (window.startOfflineGame) startOfflineGame('bot');
      return;
    }
    if (t.status !== 'open') { showToast('Bu turnuva kayıt için açık değil'); return; }

    document.getElementById('tourn-reg-title').textContent = t.name;
    document.getElementById('tourn-reg-icon').textContent  = t.icon;
    document.getElementById('tourn-reg-desc').textContent  = `${t.maxPlayers} oyunculu turnuva`;
    document.getElementById('tourn-reg-prizes').innerHTML  =
      '<div style="font-size:.33rem;font-weight:800;color:var(--muted);margin-bottom:.17rem;">🏆 Ödüller</div>' +
      t.prizes.map(p => `<div style="display:flex;justify-content:space-between;font-size:.33rem;margin:.1rem 0;">${p.place} <strong>${p.reward}</strong></div>`).join('');

    openModal('tourn-register-modal');
    haptic.light();
  }

  // ─── Turnuvaya Kayıt Onayla ───
  function confirmRegister() {
    if (!_pendingTournament) return;
    const user = UserState.get();
    if (!user) return;

    user.tournamentIds = user.tournamentIds || [];
    if (!user.tournamentIds.includes(_pendingTournament.id)) {
      user.tournamentIds.push(_pendingTournament.id);
    }

    // Backend kayıt (mevcut ise)
    if (SupabaseService.isConfigured) {
      SupabaseService.registerTournament(_pendingTournament.id, user.id).catch(() => {});
    }

    UserState.save();
    closeModal('tourn-register-modal');
    haptic.success();
    showToast(`✅ ${_pendingTournament.name}'na kaydoldun!`);
    renderList(_currentTab);
    Analytics.track('tournament_register', { id: _pendingTournament.id });
  }

  // ─── Sekme Geçişi ───
  function switchTab(tab) {
    _currentTab = tab;
    document.querySelectorAll('#tourn-tabs .tab').forEach(t => t.classList.remove('active'));
    if (event?.target) event.target.classList.add('active');
    renderList(tab);
  }

  return { renderList, renderBracket, open, confirmRegister, switchTab };
})();

// Global bağlantılar
window.TournamentSystem    = TournamentSystem;
window.switchTournTab      = (tab) => TournamentSystem.switchTab(tab);
window.confirmTournRegister= () => TournamentSystem.confirmRegister();
window.renderTournamentList= (tab) => TournamentSystem.renderList(tab);
window.currentTournTab     = 'daily';
