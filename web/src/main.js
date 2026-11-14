// Prueba de contrato (C0-08): la web lee los datos sinteticos de data/public
// sin modificarlos y chequea que respeten lo que dice docs/03-DATA-CONTRACT.md.
const base = import.meta.env.BASE_URL;
const list = document.getElementById('sites');

const getJson = async (path) => {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
};

const addItem = (text, ok = true) => {
  const li = document.createElement('li');
  li.textContent = `${ok ? 'OK' : 'ERROR'} · ${text}`;
  list.appendChild(li);
};

async function main() {
  const { sites } = await getJson('sites.json');
  for (const site of sites) {
    addItem(`${site.name} (${site.lat_deg}, ${site.lon_deg})`);
  }

  const id = sites[0].id;
  const [eph, hor, met] = await Promise.all([
    getJson(`sites/${id}/ephemeris.json`),
    getJson(`sites/${id}/horizon.json`),
    getJson(`sites/${id}/metrics.json`),
  ]);

  const n = eph.time.count;
  const lens = [eph.sun.azimuth_deg, eph.sun.elevation_deg, eph.earth.azimuth_deg, eph.earth.elevation_deg].map((a) => a.length);
  addItem(`ephemeris: ${n} muestras desde ${eph.time.start_utc}, paso ${eph.time.step_s} s`, lens.every((l) => l === n));
  addItem(`horizon: ${hor.elevation_deg.length} valores de azimut (paso ${hor.azimuth_step_deg}°)`, hor.elevation_deg.length === 360);
  addItem(`metrics: ${met.time.count} dias, sun_hours[0] = ${met.daily.sun_hours[0]}`, met.daily.sun_hours.length === met.time.count);
}

main().catch((err) => addItem(err.message, false));
