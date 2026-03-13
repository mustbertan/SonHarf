// ═══════════════════════════════════════════
// friends.js — Arkadaş Sistemi
// Liste, istek, online durum, davet
// ═══════════════════════════════════════════
'use strict';

const FriendsSystem = (() => {
  const FAKE_NAMES   = window.FAKE_NAMES   || ['KelimeKralı','SözUstası','TürkçeBil','HarfAvcısı'];
  const FAKE_AVATARS = window.FAKE_AVATARS || ['🐺','🦁','🐯','🐻'];

  // ─── Veri Başlatma ───
  function ensureData() {
    const user = UserState.get();
    if (!user) return;
    user.friends    = user.friends    || [];
    user.friendReqs = user.friendReqs || [];
    user.sentReqs   = user.sentReqs   || [];
    user.fbConnected= user.fbConnected|| false;
    user.fbFriends  = user.fbFriends  || [];
  }

  // ─── Sekme Geçişi ───
  let _currentTab = 'friends';

  function switchTab(tab) {
    _currentTab = tab;
    document.querySelectorAll('#friends-tabs .tab').forEach(t => t.classList.remove('active'));
    if (event?.target) event.target.classList.add('active');
    renderContent(tab);
  }

  // ─── Ana İçerik Render ───
  function renderContent(tab = 'friends') {
    const container = document.getElementById('friends-list-content');
    if (!container) return;
    ensureData();
    const user = UserState.get();
    if (!user) return;

    if (tab === 'friends')  { _renderFriendsList(container, user); return; }
    if (tab === 'requests') { _renderRequests(container, user); return; }
    if (tab === 'facebook') { _renderFacebook(container, user); return; }
  }

  function _renderFriendsList(container, user) {
    if (!user.friends.length) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-icon">👥</div>
        <div class="empty-title">Henüz arkadaşın yok</div>
        <div class="empty-sub">+ butonuyla arkadaş ekle</div>
      </div>
      <button class="btn btn-primary btn-full" style="margin-top:.33rem;" onclick="FriendsSystem.openAddModal()">➕ Arkadaş Ekle</button>`;
      return;
    }
    container.innerHTML = user.friends.map(f => _friendRow(f)).join('');
  }

  function _renderRequests(container, user) {
    _updateRequestBadge(user);
    if (!user.friendReqs.length) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📩</div>
        <div class="empty-title">Bekleyen istek yok</div>
      </div>`;
      return;
    }
    container.innerHTML = user.friendReqs.map(f => `
      <div class="friend-row">
        <div class="friend-avatar-wrap">
          <div class="friend-avatar-emoji">${f.avatar || '👤'}</div>
        </div>
        <div class="friend-info">
          <div class="friend-name">${escapeHtml(f.name)}</div>
          <div class="friend-status">Arkadaşlık isteği gönderdi</div>
        </div>
        <div class="friend-actions">
          <button class="friend-action-btn" style="background:rgba(78,205,196,.2);color:var(--acc3);" onclick="FriendsSystem.acceptRequest('${f.id}')">✓</button>
          <button class="friend-action-btn" style="background:rgba(255,107,107,.15);color:var(--acc);" onclick="FriendsSystem.rejectRequest('${f.id}')">✕</button>
        </div>
      </div>`).join('');
  }

  function _renderFacebook(container, user) {
    if (!user.fbConnected) {
      container.innerHTML = `<div style="text-align:center;padding:1rem;">
        <div style="font-size:2rem;margin-bottom:.33rem;">🔵</div>
        <div style="font-size:.44rem;font-weight:800;margin-bottom:.17rem;">Facebook Bağlı Değil</div>
        <div style="font-size:.33rem;color:var(--muted);margin-bottom:.44rem;">Arkadaşlarını görmek için bağlan</div>
        <button class="fb-login-btn" onclick="document.getElementById('fb-login-modal').classList.add('open')">🔵 Facebook ile Bağlan</button>
      </div>`;
      return;
    }

    const fbFriends = user.fbFriends || [];
    const headerHtml = `
      <div style="display:flex;align-items:center;gap:.22rem;padding:.33rem .44rem;background:rgba(24,119,242,.1);border:1px solid rgba(24,119,242,.3);border-radius:.44rem;margin-bottom:.33rem;">
        <div style="font-size:.7rem;">🔵</div>
        <div>
          <div style="font-size:.36rem;font-weight:800;color:var(--text);">${escapeHtml(user.fbName || 'Facebook Kullanıcısı')}</div>
          <div style="font-size:.3rem;color:var(--muted);">Bağlandı ✓${fbFriends.length ? ` · ${fbFriends.length} arkadaş` : ''}</div>
        </div>
        <button class="friend-action-btn" style="margin-left:auto;" onclick="fbLogout()">Çıkış</button>
      </div>`;

    if (!fbFriends.length) {
      container.innerHTML = headerHtml + `<div style="text-align:center;padding:1rem;color:var(--muted);font-size:.33rem;">SonHarf oynayan Facebook arkadaşın bulunamadı.</div>`;
      return;
    }

    container.innerHTML = headerHtml +
      `<div class="friend-section-title">Facebook Arkadaşları</div>` +
      fbFriends.map(f => _friendRow(f)).join('');
  }

  function _friendRow(f) {
    const statusDotCls = f.status === 'online' ? '' : f.status === 'ingame' ? 'ingame' : 'offline';
    const statusLbl    = f.status === 'online' ? '🟢 Çevrimiçi' : f.status === 'ingame' ? '🟡 Oyunda' : '⚫ Çevrimdışı';
    return `<div class="friend-row">
      <div class="friend-avatar-wrap">
        <div class="friend-avatar-emoji">${f.avatar || '👤'}</div>
        <div class="online-dot ${statusDotCls}"></div>
      </div>
      <div class="friend-info">
        <div class="friend-name">${escapeHtml(f.name)}</div>
        <div class="friend-status">${statusLbl}</div>
      </div>
      <div class="friend-actions">
        ${f.status === 'online' ? `<button class="friend-action-btn" onclick="FriendsSystem.invite('${f.id}')">⚔️ Davet</button>` : ''}
        <button class="friend-action-btn" onclick="FriendsSystem.remove('${f.id}')">✕</button>
      </div>
    </div>`;
  }

  function _updateRequestBadge(user) {
    const badge = document.getElementById('friend-req-badge');
    if (!badge) return;
    const count = user.friendReqs.length;
    badge.style.display = count > 0 ? '' : 'none';
    badge.textContent   = count;
  }

  // ─── Arkadaş Ekle Modal ───
  function openAddModal() {
    const input = document.getElementById('add-friend-input');
    const results = document.getElementById('friend-search-results');
    if (input)   input.value = '';
    if (results) results.innerHTML = '';
    openModal('add-friend-modal');
  }

  const _debouncedSearch = debounce(_doSearch, 300);

  function searchFriends(query) {
    _debouncedSearch(query);
  }

  function _doSearch(query) {
    const results = document.getElementById('friend-search-results');
    if (!results) return;
    if (!query || query.length < 2) { results.innerHTML = ''; return; }

    // Simüle edilmiş arama — gerçek uygulamada Supabase'e sor
    const found = FAKE_NAMES
      .filter(n => n.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5)
      .map((n, i) => ({ id: 'fake_' + i, name: n, avatar: FAKE_AVATARS[i % FAKE_AVATARS.length], status: 'offline' }));

    if (!found.length) {
      results.innerHTML = `<div style="font-size:.33rem;color:var(--muted);padding:.22rem;">Kullanıcı bulunamadı</div>`;
      return;
    }
    results.innerHTML = found.map(p => `
      <div class="friend-row" style="margin-bottom:.17rem;">
        <div class="friend-avatar-emoji">${p.avatar}</div>
        <div class="friend-info"><div class="friend-name">${escapeHtml(p.name)}</div></div>
        <button class="friend-action-btn" style="background:rgba(108,99,255,.2);color:var(--p2);"
          onclick="FriendsSystem.sendRequest('${p.id}','${escapeHtml(p.name)}','${p.avatar}')">+ Ekle</button>
      </div>`).join('');
  }

  // ─── İstek Gönder ───
  function sendRequest(id, name, avatar) {
    ensureData();
    const user = UserState.get();
    if (!user) return;

    if (user.friends.find(f => f.id === id)) {
      showToast('✅ Zaten arkadaşsınız'); return;
    }
    if (user.sentReqs.find(f => f.id === id)) {
      showToast('⏳ İstek zaten gönderildi'); return;
    }

    user.sentReqs.push({ id, name, avatar });
    // Simülasyon: hemen arkadaş listesine ekle
    user.friends.push({ id, name, avatar, status: 'offline' });
    UserState.save();
    haptic.success();
    showToast(`✅ ${name} arkadaş eklendi!`);
    closeModal('add-friend-modal');
    Analytics.track('friend_add', { target: id });
  }

  // ─── İstek Kabul/Reddet ───
  function acceptRequest(id) {
    ensureData();
    const user = UserState.get();
    const req  = user.friendReqs.find(f => f.id === id);
    if (!req) return;

    user.friendReqs = user.friendReqs.filter(f => f.id !== id);
    user.friends.push({ ...req, status: 'offline' });
    UserState.save();
    haptic.success();
    showToast(`✅ ${req.name} arkadaş listene eklendi!`);
    renderContent('requests');
    Analytics.track('friend_accept');
  }

  function rejectRequest(id) {
    ensureData();
    const user = UserState.get();
    user.friendReqs = user.friendReqs.filter(f => f.id !== id);
    UserState.save();
    haptic.light();
    renderContent('requests');
  }

  // ─── Arkadaş Sil ───
  function remove(id) {
    ensureData();
    const user = UserState.get();
    user.friends = user.friends.filter(f => f.id !== id);
    UserState.save();
    haptic.light();
    showToast('Arkadaşlıktan çıkarıldı');
    renderContent(_currentTab);
  }

  // ─── Oyuna Davet ───
  function invite(id) {
    const user = UserState.get();
    const f = user?.friends.find(x => x.id === id);
    showToast(`📨 ${f?.name || 'Arkadaş'}'a oyun daveti gönderildi!`);
    haptic.success();
    Analytics.track('friend_invite');
  }

  return {
    ensureData,
    renderContent,
    switchTab,
    openAddModal,
    searchFriends,
    sendRequest,
    acceptRequest,
    rejectRequest,
    remove,
    invite,
  };
})();

// Global bağlantılar
window.FriendsSystem       = FriendsSystem;
window.initFriendsData     = () => FriendsSystem.ensureData();
window.switchFriendsTab    = (tab) => FriendsSystem.switchTab(tab);
window.renderFriendsContent= (tab) => FriendsSystem.renderContent(tab);
window.openAddFriendModal  = () => FriendsSystem.openAddModal();
window.searchFriends       = (q) => FriendsSystem.searchFriends(q);
window.sendFriendRequest   = (id, name, avatar) => FriendsSystem.sendRequest(id, name, avatar);
window.acceptFriend        = (id) => FriendsSystem.acceptRequest(id);
window.rejectFriend        = (id) => FriendsSystem.rejectRequest(id);
window.removeFriend        = (id) => FriendsSystem.remove(id);
window.inviteFriend        = (id) => FriendsSystem.invite(id);
window.currentFriendsTab   = 'friends';
