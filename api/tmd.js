const SOURCE = 'https://data.tmd.go.th/api/WeatherToday/V2/?uid=api&ukey=api12345&format=json';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const upstream = await fetch(SOURCE, { signal: AbortSignal.timeout(10000) });
    if (!upstream.ok) throw new Error('TMD unavailable');
    const raw = await upstream.json();
    const stations = raw?.Stations?.Station;
    if (!Array.isArray(stations)) throw new Error('Invalid TMD response');
    const clean = stations.map(station => ({
      name: String(station.StationNameThai || '').trim(),
      province: String(station.Province || '').trim(),
      lat: Number(station.Latitude),
      lng: Number(station.Longitude),
      rain: Number(station.Observation?.Rainfall),
      observedAt: String(station.Observation?.DateTime || '')
    })).filter(station => station.name && Number.isFinite(station.lat) &&
      Number.isFinite(station.lng) && station.lat >= 5 && station.lat <= 21 &&
      station.lng >= 97 && station.lng <= 106 && Number.isFinite(station.rain) &&
      station.rain >= 0 && station.rain < 1000 && /^\d{4}-\d\d-\d\d /.test(station.observedAt));
    if (!clean.length) throw new Error('No TMD stations');
    res.setHeader('Cache-Control', 'public, max-age=900, s-maxage=1800');
    return res.status(200).json({ source: 'กรมอุตุนิยมวิทยา', stations: clean });
  } catch (_) {
    return res.status(502).json({ error: 'TMD observations unavailable' });
  }
};
