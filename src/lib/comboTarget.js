// Called-combo drill: the app announces a short sequence of punches (each
// step is a side+style pair) and checks the EXISTING punch detector's own
// emitted events against each expected step in order. No new detection
// technology — this is a sequencing/game layer on top of createPunchDetector
// from liveDetection.js, reusing its side/style classification as-is.
//
// Every announced step is also a labeled real-world sample: we know what
// punch was INTENDED before it's thrown, which freeform shadowboxing can
// never give us. Recording every detector event that fires during a step's
// active window (not just the one that matched) turns this drill into a
// live diagnostic instrument for the suspected hook/uppercut double-count
// bug — if a single intended "left hook" produces two detector events, that
// shows up directly in the recorded data instead of a guessed-at synthetic
// simulation.

export const COMBOS = [
  { key: "1", steps: [{ side: "left", style: "straight" }] },
  { key: "2", steps: [{ side: "right", style: "straight" }] },
  { key: "3", steps: [{ side: "left", style: "hook" }] },
  { key: "4", steps: [{ side: "right", style: "hook" }] },
  { key: "5", steps: [{ side: "left", style: "uppercut" }] },
  { key: "6", steps: [{ side: "right", style: "uppercut" }] },
  {
    key: "1-2",
    steps: [
      { side: "left", style: "straight" },
      { side: "right", style: "straight" },
    ],
  },
  {
    key: "1-1-2",
    steps: [
      { side: "left", style: "straight" },
      { side: "left", style: "straight" },
      { side: "right", style: "straight" },
    ],
  },
  {
    key: "1-2-3",
    steps: [
      { side: "left", style: "straight" },
      { side: "right", style: "straight" },
      { side: "left", style: "hook" },
    ],
  },
  {
    key: "2-3-2",
    steps: [
      { side: "right", style: "straight" },
      { side: "left", style: "hook" },
      { side: "right", style: "straight" },
    ],
  },
  {
    key: "3-2",
    steps: [
      { side: "left", style: "hook" },
      { side: "right", style: "straight" },
    ],
  },
  {
    key: "5-6",
    steps: [
      { side: "left", style: "uppercut" },
      { side: "right", style: "uppercut" },
    ],
  },
];

export function pickCombo(lastKey) {
  const pool = lastKey ? COMBOS.filter((c) => c.key !== lastKey) : COMBOS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function matchesStep(step, punchEvent) {
  return punchEvent.type === "punch" && punchEvent.side === step.side && punchEvent.style === step.style;
}

// Time budget per step, starting when that step becomes the active one
// (first step starts at combo announce time, so it already includes
// reaction time to hear/read the callout).
export const STEP_TIMEOUT_MS = 2200;
// Pause after a combo resolves (hit or miss) before the next one is
// announced — same "let them reset" reasoning as Dodge Mode's RECOVERY_MS.
export const RECOVERY_MS = 700;
