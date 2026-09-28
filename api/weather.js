module.exports = async function handler(req, res) {
  const latitudes = String(req.query.latitude || '').split(',').map(Number);
  const longitudes = String(req.query.longitude || '').split(',').map(Number);
  const valid = latitudes.length >= 1 && latitudes.length <= 12 &&
    latitudes.length === longitudes.length &&
    latitudes.every(value => Number.isFinite(value) && value >= 5 && value <= 21) &&
    longitudes.every(value => Number.isFinite(value) && value >= 97 && value <= 106);
  if (!valid) return res.status(400).json({ error: 'Invalid Thailand coordinates' });

  const params = new URLSearchParams({
    latitude: latitudes.join(','),
    longitude: longitudes.join(','),
    hourly: 'precipitation',
    past_days: '2',
    forecast_days: '2',
    timezone: 'Asia/Bangkok'
  });
  try {
    const upstream = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: AbortSignal.timeout(10000)
    });
    if (!upstream.ok) throw new Error('Weather service unavailable');
    const body = await upstream.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    return res.status(200).send(body);
  } catch (_) {
    return res.status(502).json({ error: 'Weather service unavailable' });
  }
};
