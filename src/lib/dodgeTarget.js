// Dodge target zones for the "reach with your head" mode — same engine
// as Pad Work (reactionTarget.js's checkTarget), just tracking relNose
// instead of relWrist, and with its own radius/speed/timeout since head
// movement during a slip or duck has a very different natural range and
// speed than a punch does.
//
// Only lateral slips and a duck are included. A real lean-away/pull-back
// dodge moves mostly toward the camera (depth), which 2D tracking can't
// see — the same foreshortening limitation documented for jabs in
// liveDetection.js, so it's left out rather than faked.
//
// At rest (head upright, facing the camera), the nose sits roughly
// (0, -0.6) relative to the shoulder midpoint (above the shoulder line —
// image y increases downward) — a guess, not a measurement. Every target
// below is placed comfortably beyond HEAD_HIT_RADIUS from that rest
// point, learning from Pad Work's first version: a target too close to
// the natural resting position can register as a hit with no real dodge
// at all.
export const DODGE_TARGETS = [
  { key: "slip-left", rel: { x: -0.5, y: -0.6 } },
  { key: "slip-right", rel: { x: 0.5, y: -0.6 } },
  { key: "duck", rel: { x: 0, y: -0.1 } },
];

export function pickDodgeTarget(lastKey) {
  const pool = lastKey ? DODGE_TARGETS.filter((t) => t.key !== lastKey) : DODGE_TARGETS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export const HEAD_HIT_RADIUS = 0.3;
export const HEAD_MIN_HIT_SPEED = 0.4;
export const DODGE_TIMEOUT_MS = 1200;
