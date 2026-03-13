// ═══════════════════════════════════════════
// auth.js — Kullanıcı Kimlik Doğrulama
// Facebook OAuth + Supabase Auth
// ═══════════════════════════════════════════
'use strict';

const AuthService = (() => {
  // ─── Facebook App Konfigürasyonu ───
  // Facebook Developer Console'dan alınan App ID
  const FB_APP_ID = '000000000000000'; // ← Gerçek App ID'yi buraya yaz
  const FB_VERSION = 'v19.0';

  let _fbInitialized = false;
  let _fbLoginInProgress = false;

  // ─── Facebook SDK Başlatma ───
  function initFacebook() {
    if (_fbInitialized || !window.FB) return;

    window.FB.init({
      appId:   FB_APP_ID,
      version: FB_VERSION,
      xfbml:   false,
      cookie:  false,  // Güvenlik: cookie kullanma
    });

    _fbInitialized = true;
    Logger.log('Auth', 'Facebook SDK başlatıldı');
  }

  // Facebook SDK'yı dinamik yükle (ihtiyaç olduğunda)
  function loadFacebookSDK() {
    if (document.getElementById('facebook-jssdk')) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id  = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/tr_TR/sdk.js';
      script.onload  = () => { initFacebook(); resolve(); };
      script.onerror = () => reject(new Error('Facebook SDK yüklenemedi'));
      document.head.appendChild(script);
    });
  }

  // ─── Facebook Giriş — Sadece Profil (isim + fotoğraf) ───
  async function loginWithFacebook(requestFriends = false) {
    if (_fbLoginInProgress) return;
    _fbLoginInProgress = true;

    try {
      await loadFacebookSDK();

      // İzin kapsamı — minimum gizlilik
      // public_profile: isim + profil fotoğrafı (zorunlu)
      // user_friends: sadece uygulamayı kullanan arkadaşlar (isteğe bağlı)
      const scope = requestFriends ? 'public_profile,user_friends' : 'public_profile';

      return new Promise((resolve, reject) => {
        window.FB.login((response) => {
          _fbLoginInProgress = false;

          if (response.status !== 'connected') {
            reject(new Error('Giriş iptal edildi'));
            return;
          }

          // Kullanıcı onay verdi — sadece gerekli alanları çek
          _fetchFbProfile(response.authResponse.accessToken, requestFriends)
            .then(resolve)
            .catch(reject);
        }, { scope, return_scopes: true });
      });
    } catch (e) {
      _fbLoginInProgress = false;
      throw e;
    }
  }

  // ─── Facebook Profil Çekme ───
  async function _fetchFbProfile(token, includeFriends) {
    // SADECE isim ve profil fotoğrafı — email veya başka veri ALINMAZ
    const fields = 'id,name,picture.type(normal)';

    return new Promise((resolve, reject) => {
      window.FB.api('/me', { fields, access_token: token }, (profile) => {
        if (!profile || profile.error) {
          reject(new Error(profile?.error?.message || 'Profil alınamadı'));
          return;
        }

        const fbUser = {
          fbId:     profile.id,
          fbName:   profile.name,                    // Sadece isim
          fbPicture: profile.picture?.data?.url || null, // Sadece fotoğraf URL
        };

        // Arkadaş listesi istendiyse
        if (includeFriends) {
          window.FB.api('/me/friends', { access_token: token }, (friendsData) => {
            // Sadece bu uygulamayı kullanan arkadaşlar döner (Facebook politikası)
            fbUser.fbFriends = (friendsData?.data || []).map(f => ({
              fbId:   f.id,
              name:   f.name,
              avatar: '👤', // Fotoğraf ayrıca çekilebilir
            }));
            resolve(fbUser);
          });
        } else {
          fbUser.fbFriends = [];
          resolve(fbUser);
        }
      });
    });
  }

  // ─── FB Giriş Simülasyonu (SDK yokken) ───
  function _simulateFbLogin(requestFriends) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          fbId:      'sim_' + Math.random().toString(36).substr(2, 8),
          fbName:    'Facebook Kullanıcısı',
          fbPicture: null,
          fbFriends: requestFriends
            ? [
                { fbId: 'f1', name: 'KelimeKralı', avatar: '🐺' },
                { fbId: 'f2', name: 'SözUstası',   avatar: '🦁' },
                { fbId: 'f3', name: 'TürkçeBil',   avatar: '🐯' },
              ]
            : [],
        });
      }, 1500);
    });
  }

  // ─── FB Kullanıcısını Sisteme Kaydet ───
  async function processFbLogin(fbUser) {
    const user = UserState.get();
    if (!user) return;

    // Kullanıcıya FB bilgilerini ekle
    user.fbConnected = true;
    user.fbId        = fbUser.fbId;
    user.fbName      = fbUser.fbName;
    user.fbPicture   = fbUser.fbPicture;

    // FB arkadaşlarını iç formata dönüştür
    user.fbFriends = fbUser.fbFriends.map(f => ({
      id:     f.fbId,
      name:   f.name,
      avatar: f.avatar || '👤',
      status: 'offline',
      isFb:   true,
    }));

    UserState.save();

    // Supabase'e FB kullanıcısını kaydet
    if (SupabaseService.isConfigured) {
      await SupabaseService.upsertUser({ ...user, fb_id: fbUser.fbId });
    }

    Analytics.track('fb_login', { had_friends: fbUser.fbFriends.length > 0 });
    return user;
  }

  // ─── FB Çıkış ───
  function logoutFacebook() {
    if (window.FB && _fbInitialized) {
      window.FB.logout(() => {});
    }
    const user = UserState.get();
    if (user) {
      user.fbConnected = false;
      user.fbId        = null;
      user.fbName      = null;
      user.fbPicture   = null;
      user.fbFriends   = [];
      UserState.save();
    }
    Analytics.track('fb_logout');
  }

  return {
    initFacebook,
    loginWithFacebook,
    processFbLogin,
    logoutFacebook,
    _simulateFbLogin, // Geliştirme ortamı için
  };
})();

// ─── UI Functions (HTML'de çağrılır) ───
async function fbLoginBasic() {
  closeModal('fb-login-modal');
  Router.showLoading('Facebook bağlanıyor...');
  try {
    const hasSdk = typeof window.FB !== 'undefined';
    const fbUser = hasSdk
      ? await AuthService.loginWithFacebook(false)
      : await AuthService._simulateFbLogin(false);
    await AuthService.processFbLogin(fbUser);
    Router.hideLoading(true);
    haptic.success();
    showToast('🔵 Facebook hesabın bağlandı!');
    renderFriendsContent('facebook');
  } catch (e) {
    Router.hideLoading(true);
    haptic.error();
    showToast('❌ ' + (e.message || 'Giriş başarısız'));
  }
}

async function fbLoginWithFriends() {
  closeModal('fb-login-modal');
  Router.showLoading('Facebook bağlanıyor...');
  try {
    const hasSdk = typeof window.FB !== 'undefined';
    const fbUser = hasSdk
      ? await AuthService.loginWithFacebook(true)
      : await AuthService._simulateFbLogin(true);
    await AuthService.processFbLogin(fbUser);
    Router.hideLoading(true);
    haptic.success();
    const cnt = (UserState.get()?.fbFriends || []).length;
    showToast(`🔵 Bağlandı! ${cnt} arkadaş bulundu.`);
    renderFriendsContent('facebook');
  } catch (e) {
    Router.hideLoading(true);
    haptic.error();
    showToast('❌ ' + (e.message || 'Giriş başarısız'));
  }
}

function fbLogout() {
  AuthService.logoutFacebook();
  haptic.light();
  showToast('Facebook bağlantısı kesildi');
  renderFriendsContent('facebook');
}

window.AuthService       = AuthService;
window.fbLoginBasic      = fbLoginBasic;
window.fbLoginWithFriends = fbLoginWithFriends;
window.fbLogout          = fbLogout;
