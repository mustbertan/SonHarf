// ═══════════════════════════════════════════
// api/kelime.js — TDK Kelime Doğrulama Proxy
// URL: /api/kelime?w=elma
// Anti-abuse: rate limiting, format validation
// ═══════════════════════════════════════════

// Basit in-memory rate limiter (serverless için)
const rateLimiter = new Map();
const RATE_LIMIT  = 60;   // 1 dakikada max istek
const RATE_WINDOW = 60_000; // ms

function checkRateLimit(ip) {
  const now = Date.now();
  const key = ip || 'unknown';

  if (!rateLimiter.has(key)) {
    rateLimiter.set(key, { count: 1, reset: now + RATE_WINDOW });
    return true;
  }

  const record = rateLimiter.get(key);
  if (now > record.reset) {
    rateLimiter.set(key, { count: 1, reset: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  return true;
}

// Bellek temizleme
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimiter.entries()) {
    if (now > record.reset) rateLimiter.delete(key);
  }
}, 120_000);

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 saat cache

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')     return res.status(405).json({ error: 'Method not allowed' });

  // Rate limiting
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress;
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ valid: false, error: 'Çok fazla istek' });
  }

  // Kelime al ve temizle
  const word = (req.query.w || '').trim().toLowerCase().normalize('NFC');

  // Validasyon
  if (!word)             return res.status(400).json({ valid: false, error: 'Kelime boş' });
  if (word.length < 2)   return res.status(400).json({ valid: false, error: 'Çok kısa' });
  if (word.length > 30)  return res.status(400).json({ valid: false, error: 'Çok uzun' });

  // Sadece Türkçe harfler
  if (!/^[a-züşğçöıâîûàèì]+$/i.test(word)) {
    return res.status(200).json({ valid: false, source: 'format', word });
  }

  // SQL injection / XSS güvenliği (zaten alfanümerik kontrol var ama yine de)
  const safeWord = word.replace(/[^a-züşğçöıâîûàèì]/gi, '');
  if (safeWord !== word) {
    return res.status(200).json({ valid: false, source: 'format' });
  }

  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 8000);

    const tdkRes = await fetch(
      `https://sozluk.gov.tr/gts?ara=${encodeURIComponent(word)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SonHarf/2.0; +https://sonharf.app)',
          'Referer':    'https://sozluk.gov.tr/',
          'Accept':     'application/json',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!tdkRes.ok) throw new Error(`TDK HTTP ${tdkRes.status}`);

    const data = await tdkRes.json();

    // TDK yanıt formatı:
    // Geçerli:  [{ madde: "elma", ... }]
    // Geçersiz: [{ error: "Sonuç bulunamadı" }]
    const isValid = Array.isArray(data) &&
                    data.length > 0 &&
                    !data[0]?.error &&
                    Boolean(data[0]?.madde);

    return res.status(200).json({
      valid:  isValid,
      source: 'tdk',
      word,
    });

  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    console.error('[kelime.js] TDK error:', err.message);

    // valid: null → client offline listeye düşer
    return res.status(503).json({
      valid:  null,
      source: isTimeout ? 'timeout' : 'error',
      error:  err.message,
    });
  }
}
