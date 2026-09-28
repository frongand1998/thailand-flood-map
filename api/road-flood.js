const BASE = 'https://floodbangkok.bangkok.go.th/bkk/dds/services/api/floods/v1/items/';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const [currentResponse, profileResponse] = await Promise.all([
      fetch(BASE + 'sensor_now?limit=-1', { signal: AbortSignal.timeout(10000) }),
      fetch(BASE + 'sensor_profile?limit=-1', { signal: AbortSignal.timeout(10000) })
    ]);
    if (!currentResponse.ok || !profileResponse.ok) throw new Error('Bangkok sensor service unavailable');
    const [current, profiles] = await Promise.all([currentResponse.json(), profileResponse.json()]);
    if (!Array.isArray(current.data) || !Array.isArray(profiles.data)) throw new Error('Invalid sensor response');
    const profileById = new Map(profiles.data.map(item => [item.id, item]));
    const now = Date.now();
    const points = current.data.map(row => {
      const profile = profileById.get(row.sensor_profile);
      const depthCm = Number(row.flood_now);
      const observedAt = String(row.timestamp || '');
      const age = now - Date.parse(observedAt + 'Z');
      return {
        name: String(profile?.name || '').trim(),
        district: String(profile?.district || '').trim(),
        lat: Number(profile?.lat), lng: Number(profile?.long),
        depthCm, observedAt,
        valid: ['normal', 'minor_flood', 'flooding'].includes(profile?.device_status) &&
          row.check_flood === true && Number.isFinite(age) && age >= -10 * 60 * 1000 && age <= 2 * 3600 * 1000
      };
    }).filter(point => point.valid && point.name && Number.isFinite(point.depthCm) &&
      point.depthCm >= 0 && point.depthCm < 300 && Number.isFinite(point.lat) &&
      Number.isFinite(point.lng) && point.lat >= 13.4 && point.lat <= 14.1 &&
      point.lng >= 100.2 && point.lng <= 101.0)
      .map(({ valid, ...point }) => point);
    if (!points.length) throw new Error('No recent road sensors');
    res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=300');
    return res.status(200).json({ source: 'สำนักการระบายน้ำ กรุงเทพมหานคร', points });
  } catch (error) {
    console.error('Bangkok road sensors unavailable', error);
    return res.status(502).json({ error: 'Bangkok road sensors unavailable', detail: String(error?.message || error) });
  }
};
