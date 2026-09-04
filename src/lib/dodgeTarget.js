// Dodge target zones for the "reach with your head" mode — same engine
// as Pad Work (reactionTarget.js's checkTarget), just tracking relNose
// instead of relWrist, and with its own radius/speed/timeout since head
// movement during a slip or duck has a very different natural range and
// speed than a punch does.
//
// Unlike Pad Work's fixed absolute target positions, these are DELTAS
// applied to wherever the head actually is the moment a target spawns
// (see DodgeMode.jsx) — real testing showed fixed absolute zones read as
// "appearing randomly in empty space," disconnected from the person's
// actual stance/distance from camera. A delta from the current position
// is always a consistent, reachable movement regardless of where they're
// standing.
//
// Only lateral slips and a duck are included. A real lean-away/pull-back
// dodge moves mostly toward the camera (depth), which 2D tracking can't
// see — the same foreshortening limitation documented for jabs in
// liveDetection.js.
export const DODGE_TARGETS = [
  { key: "slip-left", delta: { x: -0.5, y: 0 } },
  { key: "slip-right", delta: { x: 0.5, y: 0 } },
  { key: "duck", delta: { x: 0, y: 0.4 } },
];

export function pickDodgeTarget(lastKey) {
  const pool = lastKey ? DODGE_TARGETS.filter((t) => t.key !== lastKey) : DODGE_TARGETS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export const HEAD_HIT_RADIUS = 0.3;
export const HEAD_MIN_HIT_SPEED = 0.4;
export const DODGE_TIMEOUT_MS = 1200;
