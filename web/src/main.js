// Prueba de despliegue: lee sites.json desde data/public (publicDir).
const list = document.getElementById('sites');

fetch(`${import.meta.env.BASE_URL}sites.json`)
  .then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  })
  .then((data) => {
    for (const site of data.sites) {
      const li = document.createElement('li');
      li.textContent = `${site.name} (${site.lat_deg}, ${site.lon_deg})`;
      list.appendChild(li);
    }
  })
  .catch((err) => {
    list.textContent = `No se pudo cargar sites.json: ${err.message}`;
  });
