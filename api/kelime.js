// Vercel Serverless Function — TDK Kelime Doğrulama Proxy
// URL: /api/kelime?w=elma

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const word = (req.query.w || '').trim().toLowerCase();

  // Validasyon
  if (!word || word.length < 2 || word.length > 30) {
    return res.status(400).json({ valid: false, error: 'Geçersiz kelime' });
  }

  // Sadece Türkçe harfler
  if (!/^[a-züşğçöıâîû]+$/i.test(word)) {
    return res.status(200).json({ valid: false, source: 'format' });
  }

  try {
    const tdkRes = await fetch(`https://sozluk.gov.tr/gts?ara=${encodeURIComponent(word)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SonHarf/1.0)',
        'Referer': 'https://sozluk.gov.tr/',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!tdkRes.ok) throw new Error(`TDK ${tdkRes.status}`);

    const data = await tdkRes.json();

    // TDK: geçerli → [{madde:"elma",...}], geçersiz → [{error:"Sonuç bulunamadı"}]
    const isValid = Array.isArray(data) && data.length > 0 && !data[0]?.error && !!data[0]?.madde;

    return res.status(200).json({ valid: isValid, source: 'tdk', word });

  } catch (err) {
    console.error('TDK hatası:', err.message);
    // valid:null → client offline listeye düşer
    return res.status(503).json({ valid: null, source: 'error', error: err.message });
  }
}
