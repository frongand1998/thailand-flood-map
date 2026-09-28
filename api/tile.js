const MAX_ZOOM = { base: 18, elevation: 12 };

module.exports = async function handler(req, res) {
  const { kind, z: rawZ, x: rawX, y: rawY } = req.query;
  const z = Number(rawZ), x = Number(rawX), y = Number(rawY);
  const valid = Object.hasOwn(MAX_ZOOM, kind) &&
    Number.isInteger(z) && z >= 0 && z <= MAX_ZOOM[kind] &&
    Number.isInteger(x) && Number.isInteger(y) &&
    x >= 0 && y >= 0 && x < 2 ** z && y < 2 ** z;
  if (!valid) return res.status(400).json({ error: 'Invalid tile coordinates' });

  const urls = kind === 'elevation'
    ? [`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`]
    : [
        `https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`,
        `https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}`
      ];

  for (const url of urls) {
    try {
      const upstream = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const type = upstream.headers.get('content-type') || '';
      if (!upstream.ok || !type.startsWith('image/')) continue;
      const bytes = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', type);
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
      return res.status(200).send(bytes);
    } catch (_) { /* Try the next approved source. */ }
  }
  return res.status(502).json({ error: 'Map tile unavailable' });
};
