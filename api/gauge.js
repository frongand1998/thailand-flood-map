const SOURCE = 'https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load';
const distanceKm = (a, b) => {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const c = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
};

module.exports = async function handler(req, res) {
  const point = { lat: Number(req.query.lat), lng: Number(req.query.lng) };
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!Number.isFinite(point.lat) || point.lat < 5 || point.lat > 21 ||
      !Number.isFinite(point.lng) || point.lng < 97 || point.lng > 106)
    return res.status(400).json({ error: 'Invalid Thailand coordinates' });
  try {
    const upstream = await fetch(SOURCE, { signal: AbortSignal.timeout(12000) });
    if (!upstream.ok) throw new Error('Water levels unavailable');
    const rows = (await upstream.json())?.waterlevel_data?.data;
    if (!Array.isArray(rows)) throw new Error('Invalid water level response');
    const stations = rows.map(row => ({
      name: String(row.station?.tele_station_name?.th || '').trim(),
      lat: Number(row.station?.tele_station_lat),
      lng: Number(row.station?.tele_station_long),
      levelMsl: row.waterlevel_msl == null ? NaN : Number(row.waterlevel_msl),
      observedAt: String(row.waterlevel_datetime || ''),
      agency: String(row.agency?.agency_shortname?.th || '')
    })).filter(station => station.name && Number.isFinite(station.lat) &&
      Number.isFinite(station.lng) && Number.isFinite(station.levelMsl) &&
      station.levelMsl > -10 && station.levelMsl < 2000 &&
      /^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(station.observedAt));
    const nearest = stations.map(station => ({ ...station, distanceKm: distanceKm(point, station) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)[0];
    if (!nearest || nearest.distanceKm > 50) return res.status(404).json({ error: 'No gauge within 50 km' });
    const age = Date.now() - Date.parse(nearest.observedAt.replace(' ', 'T') + ':00+07:00');
    if (!Number.isFinite(age) || age < 0 || age > 6 * 3600 * 1000)
      return res.status(404).json({ error: 'Nearby gauge is not current' });
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    return res.status(200).json({ source: 'สถาบันสารสนเทศทรัพยากรน้ำ (สสน.)', station: nearest });
  } catch (_) {
    return res.status(502).json({ error: 'Water levels unavailable' });
  }
};
