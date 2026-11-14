export function horizonAt(horizon, azimuthDeg) {
  const values = horizon.elevation_deg;
  const step = horizon.azimuth_step_deg;
  const start = horizon.azimuth_start_deg;
  const position = ((azimuthDeg - start) / step) % values.length;
  const normalized = position < 0 ? position + values.length : position;
  const lower = Math.floor(normalized);
  const fraction = normalized - lower;
  const upper = (lower + 1) % values.length;
  return values[lower] + (values[upper] - values[lower]) * fraction;
}
