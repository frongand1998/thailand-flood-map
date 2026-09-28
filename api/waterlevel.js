const SOURCE = 'https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const upstream = await fetch(SOURCE, { signal: AbortSignal.timeout(12000) });
    if (!upstream.ok) throw new Error('Water levels unavailable');
    const raw = await upstream.json();
    const rows = raw?.waterlevel_data?.data;
    if (!Array.isArray(rows)) throw new Error('Invalid water level response');
    const stations = rows.map(row => ({
      name: String(row.station?.tele_station_name?.th || '').trim(),
      lat: Number(row.station?.tele_station_lat),
      lng: Number(row.station?.tele_station_long),
      levelMsl: row.waterlevel_msl == null ? NaN : Number(row.waterlevel_msl),
      observedAt: String(row.waterlevel_datetime || ''),
      agency: String(row.agency?.agency_shortname?.th || '')
    })).filter(station => station.name && Number.isFinite(station.lat) &&
      Number.isFinite(station.lng) && station.lat >= 5 && station.lat <= 21 &&
      station.lng >= 97 && station.lng <= 106 && Number.isFinite(station.levelMsl) &&
      station.levelMsl > -10 && station.levelMsl < 2000 &&
      /^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(station.observedAt));
    if (!stations.length) throw new Error('No water level stations');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    return res.status(200).json({ source: 'สถาบันสารสนเทศทรัพยากรน้ำ (สสน.)', stations });
  } catch (_) {
    return res.status(502).json({ error: 'Water levels unavailable' });
  }
};
