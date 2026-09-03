// Target definitions shared by the "reach this point with a tracked body
// part" game engine — Pad Work reaches with the wrist, Dodging (later)
// will reach with the head, but both are the same underlying mechanic:
// show a target in the same normalized, shoulder-relative space already
// used for wrist tracking (poseMath.js's relWrist), and check when the
// tracked point arrives. Doing it this way sidesteps the much harder
// "classify what movement the person just made" problem entirely — we
// only ever need to know whether a point reached a zone, which is a
// simple distance check, not a motion classifier.

// Three canonical pad heights per side, defined as relWrist-space
// coordinates (offset from that arm's own shoulder, normalized by
// shoulder width) — a rough stand-in for how a real coach holds mitts at
// jab height, hook height, and body-shot height. Untested against real
// use; expect these to need retuning once tried for real, same as every
// other threshold in this app.
export const PAD_TARGETS = [
  { key: "left-high", side: "left", rel: { x: -0.15, y: -0.3 } },
  { key: "left-mid", side: "left", rel: { x: -0.35, y: 0.05 } },
  { key: "left-low", side: "left", rel: { x: -0.1, y: 0.4 } },
  { key: "right-high", side: "right", rel: { x: 0.15, y: -0.3 } },
  { key: "right-mid", side: "right", rel: { x: 0.35, y: 0.05 } },
  { key: "right-low", side: "right", rel: { x: 0.1, y: 0.4 } },
];

// Avoids repeating the same target twice in a row, which would make a
// stretch of the drill trivially easy (arm already there).
export function pickTarget(lastKey) {
  const pool = lastKey ? PAD_TARGETS.filter((t) => t.key !== lastKey) : PAD_TARGETS;
  return pool[Math.floor(Math.random() * pool.length)];
}

// How close (in the same shoulder-width-normalized units as PAD_TARGETS)
// the tracked point has to get to count as reaching the target. Generous
// on purpose — this drill is about reaction speed, not pixel-precise
// aim, and MediaPipe's own jitter needs some margin regardless.
export const HIT_RADIUS = 0.35;
// How long a target stays live before it's marked missed and replaced.
export const TARGET_TIMEOUT_MS = 1500;

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Pure decision for one frame: given the live target, the tracked point's
// current relWrist-space position (or null if not confidently tracked
// this frame), and the current time, decide whether this frame is a hit,
// a timeout-miss, or neither yet. Kept separate from the render/game loop
// so it can be tested against synthetic sequences without a browser.
export function checkTarget(target, rel, now) {
  if (rel && dist(rel, target.rel) < HIT_RADIUS) return "hit";
  if (now > target.timeoutAt) return "miss";
  return null;
}
