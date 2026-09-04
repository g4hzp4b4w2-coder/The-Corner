// Fixed, screen-anchored dodge zones — NOT body-relative. Two earlier
// approaches both failed real testing: a fixed absolute body-relative
// point felt disconnected ("appearing randomly in empty space" — it
// didn't account for how close/far or off-center the person actually
// stood), and a delta from wherever the head currently is compounds
// over consecutive targets when the head doesn't fully return to center
// between them (duck, then duck again from an already-lower position,
// walking the target downward over the whole round). Anchoring to fixed
// fractions of the screen avoids both: the zones never move and can't
// accumulate drift.
export const DODGE_ZONES = [
  { key: "slip-left", xMax: 0.35 },
  { key: "slip-right", xMin: 0.65 },
  { key: "duck", yMin: 0.65 },
];

export function pickDodgeZone(lastKey) {
  const pool = lastKey ? DODGE_ZONES.filter((z) => z.key !== lastKey) : DODGE_ZONES;
  return pool[Math.floor(Math.random() * pool.length)];
}

// nxFrac/nyFrac: the tracked head position as a 0-1 fraction of the
// frame (same space video/canvas coordinates already use).
export function isInZone(zone, nxFrac, nyFrac) {
  if (zone.xMax != null && nxFrac >= zone.xMax) return false;
  if (zone.xMin != null && nxFrac <= zone.xMin) return false;
  if (zone.yMin != null && nyFrac <= zone.yMin) return false;
  if (zone.yMax != null && nyFrac >= zone.yMax) return false;
  return true;
}

export const HEAD_MIN_HIT_SPEED = 0.4;
export const DODGE_TIMEOUT_MS = 1200;
// Brief pause after a dodge resolves before the next one appears —
// without it, the very next target could demand another dodge before
// there's been any real chance to recover toward a neutral position.
export const RECOVERY_MS = 500;
