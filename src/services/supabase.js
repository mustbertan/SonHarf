// ═══════════════════════════════════════════
// supabase.js — Supabase Servis Katmanı
// Tüm veritabanı ve realtime işlemleri burada
// ═══════════════════════════════════════════
'use strict';

const SupabaseService = (() => {
  // ▼▼▼ BURAYA KENDİ SUPABASE BİLGİLERİNİ GİR ▼▼▼
  const URL = 'https://dhpmuxqpozxxyeehfiqn.supabase.co';
  const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRocG11eHFwb3p4eHllZWhmaXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzOTIxMDIsImV4cCI6MjA4ODk2ODEwMn0.A-Qgss8-uACYc7apgZGf85G6wXt2Wgxg7DY3oaAHQcw';
  // ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲

  const CONFIGURED = !URL.includes('SENIN_PROJE');
  const HEADERS = {
    'apikey': KEY,
    'Authorization': `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  let _client = null;

  function init() {
    if (!CONFIGURED || _client) return;
    if (!window.supabase) { Logger.warn('Supabase', 'SDK yüklenmedi'); return; }
    _client = window.supabase.createClient(URL, KEY);
    Logger.log('Supabase', '✅ Bağlantı hazır');
    EventBus.emit('supabase:ready');
  }

  // ─── REST Helpers ───
  async function get(path) {
    const r = await fetch(`${URL}/rest/v1/${path}`, { headers: HEADERS });
    if (!r.ok) throw new Error(`Supabase GET ${r.status}: ${path}`);
    return r.json();
  }

  async function post(path, body) {
    const r = await fetch(`${URL}/rest/v1/${path}`, {
      method: 'POST', headers: HEADERS, body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(`Supabase POST ${r.status}: ${path}`);
    return r.json();
  }

  async function patch(path, body) {
    const r = await fetch(`${URL}/rest/v1/${path}`, {
      method: 'PATCH', headers: HEADERS, body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(`Supabase PATCH ${r.status}: ${path}`);
    return r.ok;
  }

  async function del(path) {
    const r = await fetch(`${URL}/rest/v1/${path}`, {
      method: 'DELETE', headers: HEADERS
    });
    return r.ok;
  }

  async function rpc(fn, params = {}) {
    const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(params),
    });
    if (!r.ok) throw new Error(`Supabase RPC ${r.status}: ${fn}`);
    return r.json();
  }

  // ─── User Operations ───
  async function upsertUser(user) {
    if (!CONFIGURED) return;
    try {
      await post('players?on_conflict=id', {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        country: user.country,
        total_score: user.totalScore || 0,
        total_matches: user.totalMatches || 0,
        wins: user.wins || 0,
        level: user.level || 1,
        updated_at: new Date().toISOString(),
      });
    } catch (e) { Logger.warn('Supabase', 'upsertUser failed', e); }
  }

  async function fetchLeaderboard(type = 'global', limit = 50) {
    if (!CONFIGURED) return null;
    try {
      const query = type === 'weekly'
        ? `players?select=id,username,avatar,country,total_score&order=weekly_score.desc&limit=${limit}`
        : `players?select=id,username,avatar,country,total_score&order=total_score.desc&limit=${limit}`;
      return await get(query);
    } catch (e) { Logger.warn('Supabase', 'fetchLeaderboard failed', e); return null; }
  }

  // ─── Room Operations ───
  async function createRoom(roomData) {
    return post('game_rooms', roomData);
  }

  async function findWaitingRoom() {
    return get('game_rooms?status=eq.waiting&select=id,players&order=created_at.asc&limit=1');
  }

  async function updateRoom(roomId, data) {
    return patch(`game_rooms?id=eq.${roomId}`, data);
  }

  async function deleteRoom(roomId) {
    return del(`game_rooms?id=eq.${roomId}`);
  }

  // ─── Tournament Operations ───
  async function fetchTournaments(type) {
    if (!CONFIGURED) return null;
    try {
      return await get(`tournaments?type=eq.${type}&order=created_at.desc&limit=10`);
    } catch (e) { Logger.warn('Supabase', 'fetchTournaments failed', e); return null; }
  }

  async function registerTournament(tournamentId, userId) {
    if (!CONFIGURED) return false;
    try {
      await post('tournament_players', { tournament_id: tournamentId, user_id: userId, registered_at: new Date().toISOString() });
      return true;
    } catch (e) { Logger.warn('Supabase', 'registerTournament failed', e); return false; }
  }

  // ─── Realtime Channel ───
  function createChannel(roomId, handlers) {
    if (!_client) return null;
    const user = UserState.get();
    if (!user) return null;

    const channel = _client.channel(`room:${roomId}`, {
      config: { presence: { key: user.id } }
    });

    if (handlers.onPresenceSync) {
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        handlers.onPresenceSync(state);
      });
    }

    if (handlers.onBroadcast) {
      channel.on('broadcast', { event: 'game_event' }, ({ payload }) => {
        handlers.onBroadcast(payload);
      });
    }

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          userId: user.id,
          name: user.username,
          avatar: user.avatar,
          score: user.totalScore || 0,
        });
        if (handlers.onJoined) handlers.onJoined(channel);
      }
    });

    return channel;
  }

  async function broadcast(channel, payload) {
    if (!channel) return;
    return channel.send({ type: 'broadcast', event: 'game_event', payload });
  }

  // ─── Server-Authoritative Word Validation ───
  async function validateWordServer(word, roomId, playerId) {
    if (!CONFIGURED) return { valid: null, source: 'offline' };
    try {
      return await rpc('validate_game_word', { word, room_id: roomId, player_id: playerId });
    } catch (e) {
      Logger.warn('Supabase', 'Server word validation failed', e);
      return { valid: null, source: 'rpc_error' };
    }
  }

  // ─── Score Submission (Anti-Cheat) ───
  async function submitScore(matchData) {
    if (!CONFIGURED) return;
    try {
      // Server-side score validation — client verisi kabul edilmez
      await rpc('submit_match_score', matchData);
    } catch (e) { Logger.warn('Supabase', 'submitScore failed', e); }
  }

  return {
    init,
    get isConfigured() { return CONFIGURED; },
    get client() { return _client; },
    get,
    post,
    patch,
    del,
    rpc,
    upsertUser,
    fetchLeaderboard,
    createRoom,
    findWaitingRoom,
    updateRoom,
    deleteRoom,
    fetchTournaments,
    registerTournament,
    createChannel,
    broadcast,
    validateWordServer,
    submitScore,
  };
})();

// Geriye dönük uyumluluk
window.SB_CONFIGURED = SupabaseService.isConfigured;
window.initSupabase  = () => SupabaseService.init();
window.sbGet         = (p) => SupabaseService.get(p);
window.sbPost        = (p, b) => SupabaseService.post(p, b);
window.sbPatch       = (p, b) => SupabaseService.patch(p, b);
window.sbDelete      = (p) => SupabaseService.del(p);
window.SupabaseService = SupabaseService;
