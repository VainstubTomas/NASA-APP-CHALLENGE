# ADR-006: Official resources: Horizons as ephemeris source and elevation map to be confirmed

- **Status**: Accepted (the use of the Horizons API as source was indicated by the event organizer; the "to verify" points and the elevation map source are closed in C0-04 and, for the elevation map, in C5-05, formerly C0-03: ADR-011 moved it to the end of layer 5)
- **Date**: 2026-11-13
- **Decided by**: the event organizer (use of Horizons) and the team

## Context
The repo was set up before the resources were released and assumed the Resources tab would bring SPICE kernels and the LOLA elevation map `LDEM_80S_80MPP_ADJ.TIF`. The actual resources, published on 13/11, are different:

| Resource | What it offers |
|---|---|
| **JPL Horizons** (NASA/JPL) | Positions of the Sun and the Earth seen from any point on the Moon |
| **Quickmap** (Arizona State University, LRO data) | Interactive map with high-resolution images and topography |
| **Moon Trek** (NASA) | 3D visualization of the surface and its topography |
| **CSA Lunar Exploration** (Canadian Space Agency) | Portal on missions and Canada's contribution to Artemis |

No data files were delivered: neither kernels nor maps.

## Decision
1. **Ephemerides: the JPL Horizons API is the source** (it was previously only the validation reference). SPICE is discarded.
   - Query per site and per body: observer table, Sun (`10`) and Earth (`399`), observer on the lunar surface (`CENTER='coord@301'`), azimuth and elevation (`QUANTITIES=4`) in degrees, 1 h step, no refraction, in UTC. The exact parameter names are confirmed against the API documentation in C0-04.
   - Raw responses are saved in `data/raw/horizons/` (not versioned, with a cloud copy) so we do not depend on Horizons during the event.
   - **To verify with a known case before generating all sites** (the result is recorded here; verified in C0-04 on 2026-11-14 with `precompute/ephemeris/horizons_client.py` and `tests/test_horizons_client.py`):
     - [x] Horizons' azimuth is 0° = north and increases clockwise. The response declares it ("Azimuth is measured clockwise from north: North(0) -> East(90) -> South(180) -> West(270)"), and two known cases confirm it: on the lunar equator the Sun rises at an azimuth of about 90° and sets at about 270°, and from 0°N 30°E the Earth is to the west (azimuth about 278°).
     - [x] The `SITE_COORD` longitude is east-positive. The header says `Center geodetic : 30.0, 0.0, 0.0 {E-lon(deg),Lat(deg),Alt(km)}` and `Center pole/equ : MEAN_ME {East-longitude positive}`. The parser fails if Horizons returns another unit or a different site than the one requested.
     - [x] The query latitude matches our planetocentric latitude. With `COORD_TYPE=GEODETIC`, Horizons models the Moon as a sphere (`Center radii : 1737.4, 1737.4, 1737.4 km`), and on a sphere the geodetic and planetocentric latitudes are the same.
     - [x] The output time scale is UTC. The column is `Date__(UT)__HR:MN` and the response clarifies that "Times AFTER 1962 are in UTC". For future dates Horizons uses the last known leap second, which does not affect a 1 h step.
     - [x] The row limit per query and how to split the range: **90,000 instants**. With more, Horizons returns an error ("Output length exceeded, 90648 times requested, max. is 90000") instead of truncating. The client splits the range into chunks of 90,000 (`split_range`); with a 1 h step, that is about 10 years per query.
   - **Bulk download** (C0-13, `precompute/ephemeris/download_horizons.py`). Range: 2026-11-01T00:00:00Z to 2027-02-28T23:00:00Z, 1 h step, 2880 samples (the contract's range). It fits in a single query per site and body, far below the 90,000 limit. Measured on 2026-11-14: the 14 real sites in `sites.json` times Sun and Earth are 28 queries, about 70 s with a 1 s pause between queries, and about 4.4 MB of raw data in `data/raw/horizons/` (not versioned). The synthetic site is not downloaded. If the network fails, the script retries; Horizons errors are reported and not retried.
   - **Query confirmed against the API** (`https://ssd.jpl.nasa.gov/api/horizons.api`): `format=json`, `COMMAND='10'|'399'`, `OBJ_DATA='NO'`, `MAKE_EPHEM='YES'`, `EPHEM_TYPE='OBSERVER'`, `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `SITE_COORD='<E-lon>,<lat>,0'`, `START_TIME`/`STOP_TIME` in UTC (`'YYYY-MM-DD HH:MM'`, inclusive), `STEP_SIZE='60 m'`, `QUANTITIES='4'`, `ANG_FORMAT='DEG'`, `APPARENT='AIRLESS'`, `CSV_FORMAT='YES'`, `TIME_TYPE='UT'`. The columns read are `Azi_(a-app)` and `Elev_(a-app)`: apparent azimuth and elevation without atmosphere, of the **center** of the disc and topocentric.
   - **Manual comparison with the Horizons web interface** (C0-04). Done by Tomás Vainstub on 2026-11-14 at <https://ssd.jpl.nasa.gov/horizons/app.html>. Configuration: Observer Table, Target Body = Sun (10) or Earth (399), Observer Location = Moon (301) with the coordinates from the table, quantity 4, no refraction, output in degrees and a 6 h step from 2026-11-14 00:00 UTC. This way, the three dates fall on rows of the output. The 12 rows compared match the client down to the last printed decimal. The Earth's values from 30°E and from 89.5°S were not loaded in the web; the geometric tests cover them. The points are geometric and not landing sites: the real list of sites is C0-07. The tolerance is the one from ADR-005 (0.1°).
     - Evidence: the web outputs for the Sun from 0°N 30°E and from 89.5°S 0°E are in `docs/adr/evidencia/ADR-006-horizons-web/`. Their header says `WWW_USER`, while the API ones say `API_USER`. The outputs for 0°N 0°E (Sun and Earth) were not kept.
     - That they match exactly is expected, because the web and the API use the same engine. What the comparison confirms is that the client builds the query the same way a person loading it by hand would, and that it reads the table correctly. It is not an independent validation of the ephemerides.

     | Lat, E-lon (°) | UTC | Body | Client az (°) | Client el (°) | Web: az / el | Match? |
     |---|---|---|---|---|---|---|
     | 0, 0 | 2026-11-14T00:00:00Z | Sun | 91.939942 | -36.602284 | 91.939942 / -36.602284 | ✅ |
     | 0, 0 | 2026-11-21T12:00:00Z | Sun | 92.657444 | 54.591315 | 92.657444 / 54.591315 | ✅ |
     | 0, 0 | 2026-11-30T06:00:00Z | Sun | 268.437933 | 19.173705 | 268.437933 / 19.173705 | ✅ |
     | 0, 0 | 2026-11-14T00:00:00Z | Earth | 344.456450 | 85.409203 | 344.456450 / 85.409203 | ✅ |
     | 0, 0 | 2026-11-21T12:00:00Z | Earth | 232.654574 | 81.449201 | 232.654574 / 81.449201 | ✅ |
     | 0, 0 | 2026-11-30T06:00:00Z | Earth | 88.488658 | 83.696534 | 88.488658 / 83.696534 | ✅ |
     | 0, 30 | 2026-11-14T00:00:00Z | Sun | 91.567718 | -6.615682 | 91.567718 / -6.615682 | ✅ |
     | 0, 30 | 2026-11-21T12:00:00Z | Sun | 105.995387 | 84.405446 | 105.995387 / 84.405446 | ✅ |
     | 0, 30 | 2026-11-30T06:00:00Z | Sun | 268.497923 | -10.816083 | 268.497923 / -10.816083 | ✅ |
     | 0, 30 | 2026-11-14T00:00:00Z | Earth | 278.449072 | 58.366038 | | |
     | 0, 30 | 2026-11-21T12:00:00Z | Earth | 261.438845 | 52.746055 | | |
     | 0, 30 | 2026-11-30T06:00:00Z | Earth | 270.410409 | 66.163503 | | |
     | -89.5, 0 | 2026-11-14T00:00:00Z | Sun | 126.627333 | 1.258335 | 126.627333 / 1.258335 | ✅ |
     | -89.5, 0 | 2026-11-21T12:00:00Z | Sun | 35.387998 | 1.946330 | 35.387998 / 1.946330 | ✅ |
     | -89.5, 0 | 2026-11-30T06:00:00Z | Sun | 289.168108 | 1.638940 | 289.168108 / 1.638940 | ✅ |
     | -89.5, 0 | 2026-11-14T00:00:00Z | Earth | 358.773423 | -4.148545 | | |
     | -89.5, 0 | 2026-11-21T12:00:00Z | Earth | 353.209670 | 5.383071 | | |
     | -89.5, 0 | 2026-11-30T06:00:00Z | Earth | 6.272055 | 0.064782 | | |

     To repeat a row: `python -m precompute.ephemeris.horizons_client --lat <lat> --lon <lon> --body sun|earth --start <UTC> --stop <UTC>`.
2. **Terrain: the elevation map comes from Moon Trek or Quickmap, if they allow exporting it** (C5-05, formerly C0-03; ADR-011, 1-hour timebox). The horizon calculation (part 2) does not change.
   - Backup plan: `LDEM_80S_80MPP_ADJ.TIF` from the LOLA PDS archive (public NASA data, outside the resources list), only with the organizers' OK (C0-11).
   - Plan C: if there is no map in time, scale back to layer 1 (no real horizon), per the rule "cut, do not stretch".
   - Chosen source (C5-05, #13): `LRO_LOLA_DEM_Global_128ppd_v04` (LRO LOLA DEM, Moon Trek). Raw elevation in meters, Float32, 128 ppd (~237 m/px at the equator), projection ESRI 104903 (GCS_Moon_2000). It is queried by crop with `ImageServer/exportImage` (`precompute/terrain/lola_dem.py`); the global file (2.2 GB) is not downloaded. Discarded: `LRO_LOLAKaguya_DEM_60N60S_512ppd` (only `Mosaic`, 453 GB) and the polar `LRO_LOLA_DEM_SPole*` products as the single source (they do not cover Apollo 11 or Apollo 14).
   - South pole (C5-06, #16): sites at lat ≤ -75.7° (Odysseus IM-1 and Intuitive Machines 2) use `LRO_LOLA_DEM_SPole75_30mp_v04` (30 m/px, south polar stereographic, the service's own projection; not the `_EQ` version, which has 87 m/px in latitude). At 237 m/px the Odysseus horizon was off by up to 4.8°. The horizon is computed with great-circle rays and bilinear interpolation (`precompute/terrain/horizon_profile.py`), validated against an independent azimuthal equidistant calculation (max difference 0.02°). 20 km is enough: up to 60 km the horizon does not change at those two sites.
   - Illumination (C5-07, #51): `python -m precompute.terrain.illumination_check --lola` compares the % of time with Sun and with Earth at south pole sites (from `metrics.json`, with relief; 2026-11-01 to 2027-03-01) with LOLA's average solar and Earth disc visibility (Mazarico et al. 2011, `AVGVISIB_65S_240M_201608` and `AVGVISIB_75S_120M_201608`, plus their `_EARTH` versions; period 2009-2013; LOLA PDS EXTRAS, mirror http://imbrium.mit.edu/EXTRAS/ILLUMINATION/; it is the average illumination layer Quickmap shows). Used only as a validation reference, not as published data; values are stored in `tests/reference/lola_avgvisib.json`. Result (ours vs LOLA 240 m / 120 m): Intuitive Machines 2, Sun 49.3 % vs 45.0 % / 46.8 % and Earth 93.6 % vs 92.6 % / 93.1 %; Odysseus IM-1, Sun 40.2 % vs 41.1 % / 35.6 % and Earth 100 % vs 100 %; Chandrayaan-3, Sun 48.9 % vs 48.3 % and Earth 100 % vs 100 %. Largest difference: 4.6 points. `tests/test_illumination_check.py` requires 10 points or less, because the periods differ and our horizon reaches 20 km. Map orientation was checked by reading `LDEM_75S_240M` with the same convention: 5323 m at IM-2 and 2600 m at Odysseus, vs 5326.5 m and 2594.5 m from Moon Trek.
   - External references: Apollo 11, LROC "Spacecraft Related Coordinates, 2016 update" (https://lroc.im-ldi.com/images/938): descent stage -1928 m (GLD100 model, not LOLA), matches the crop. Chang'e 4, Nature s41467-019-12278-3: landing at 177.5991°E, 45.4446°S, ~-5935 m; crop: -5930 m.
3. **Validation** (partly replaces ADR-005): since Horizons is the source, we verify that **we read it correctly**.
   - Tests against saved Horizons responses in `tests/reference/`, with the exact query that generated them.
   - Manual comparison with the Horizons web interface at 3 sites and 3 dates.
   - The terrain is compared roughly against illumination maps (for example, from Quickmap, if it offers them).
4. **Data contract: no schema changes** (`schema_version` stays at 1.0). Only the values of `ephemeris.source` and `horizon.dem` change, since they are free text.
5. **Sites**: the coordinates are verified in Quickmap or Moon Trek and cited with their link in `source_url`.
6. **Pitch**: Quickmap, Moon Trek and Horizons are "today's powerful but complex tools"; the CSA portal provides international context (C0-12).

## Discarded alternatives
- Keeping SPICE: not a challenge resource, adds heavy kernels and an own calculation that would still have to be validated against Horizons.
- Asking Horizons for the horizon or the relief: Horizons does not model the local terrain; the elevation map is still needed for that.

## Consequences
- `precompute/requirements.txt`: `spiceypy` goes out and `requests` comes in.
- Issues C0-02, C0-03, C0-04, C0-05, C0-06, C0-11, C1-01 and C2-01 are rewritten, and C0-12 is added.
- Horizons becomes an external dependency: everything must be downloaded before Saturday and work must run from the cache.
- The official challenge text is already in `docs/en/07-DESAFIO-OFICIAL.md`. Confirming the evaluation criteria with the organizers (C0-11) is still pending: the challenge page does not publish them.
