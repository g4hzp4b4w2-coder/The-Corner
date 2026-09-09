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
// jab height, hook height, and body-shot height.
//
// These need real separation from the guard/rest position (wrist near
// the shoulder, roughly rel ≈ (0, 0.1)) relative to HIT_RADIUS below —
// the first version placed "high" at distance ~0.335 from that rest spot,
// which is INSIDE HIT_RADIUS (0.35): just resting the guard there could
// already count as a hit with no punch thrown, confirmed by real testing.
// Pushed out further here so every target sits comfortably beyond
// HIT_RADIUS from a natural guard position — still retuning against real
// use, like every other threshold in this app.
export const PAD_TARGETS = [
  { key: "left-high", side: "left", rel: { x: -0.25, y: -0.45 } },
  { key: "left-mid", side: "left", rel: { x: -0.55, y: 0.05 } },
  { key: "left-low", side: "left", rel: { x: -0.2, y: 0.55 } },
  { key: "right-high", side: "right", rel: { x: 0.25, y: -0.45 } },
  { key: "right-mid", side: "right", rel: { x: 0.55, y: 0.05 } },
  { key: "right-low", side: "right", rel: { x: 0.2, y: 0.55 } },
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
// A hand casually drifted into the target zone (no punch thrown at all)
// must not count — the arm has to have actually been moving. This is
// checked against the PEAK speed over a short trailing window (see
// reactionTracker.js), not the instantaneous speed the exact frame the
// wrist enters the zone, since a real punch is already decelerating by
// the time it arrives. Well below a real punch's speed, well above idle
// hand tremor/jitter; untested against real use like every other
// threshold here.
export const MIN_HIT_SPEED = 0.5;

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Pure decision for one frame: given the live target, the tracked point's
// current position in the same rel-space the target was defined in (or
// null if not confidently tracked this frame), its recent peak speed,
// and the current time, decide whether this frame is a hit, a
// timeout-miss, or neither yet. Kept separate from the render/game loop
// so it can be tested against synthetic sequences without a browser.
// hitRadius/minHitSpeed default to Pad Work's values but are overridable
// so Dodging (head movement has a different natural range/speed than a
// punch) can pass its own.
export function checkTarget(target, rel, recentPeakSpeed, now, { hitRadius = HIT_RADIUS, minHitSpeed = MIN_HIT_SPEED } = {}) {
  if (rel && recentPeakSpeed >= minHitSpeed && dist(rel, target.rel) < hitRadius) return "hit";
  if (now > target.timeoutAt) return "miss";
  return null;
}
