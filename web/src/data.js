// Carga de los datos de la web (#32, "primera unión": la web lee datos reales).
// Uso:
//   import { loadSite, loadSites } from './data.js';
//   import { horizonAt } from './horizon.js';
//   const { ephemeris, horizon } = await loadSite('apollo-11');
//   horizonAt(horizon, 47.3)   // altura del horizonte en grados hacia el azimut 47,3°
//   const sites = await loadSites();   // lista de sites.json
// Cada archivo se descarga una sola vez. Si un archivo no cumple el formato que espera la web,
// loadSite rechaza con un error que lista los problemas (en vez de mostrar números raros).
// La lógica está en data-core.js (probada con `npm test`); acá solo se conecta con el navegador.
import { createFetchJson, createSiteLoader } from './data-core.js';

const loader = createSiteLoader(createFetchJson(import.meta.env.BASE_URL, (url) => fetch(url)));

export const { loadSite, loadSites } = loader;
