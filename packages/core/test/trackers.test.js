// Smoke tests for the stateful tracker/detector factories — feed a short
// synthetic sequence of moving landmarks through each and check they don't
// throw and return the expected shapes. Not exhaustive behavior tests
// (that would mean re-deriving the tuned thresholds), just "the copy still
// runs and produces sane output".
import { test } from "node:test";
import assert from "node:assert/strict";
import { createArmTracker, summarizeSeed } from "../src/armTracker.js";
import { createReactionTracker } from "../src/reactionTracker.js";
import { createHeadTracker } from "../src/headTracker.js";
import { createPunchDetector } from "../src/liveDetection.js";
import { createImpactDetector, rmsOf, rmsOfFloat32 } from "../src/audioImpact.js";
import { makeLandmarks } from "./helpers.js";

// A short punch-and-retract sequence for the right wrist.
function punchSequence() {
  const frames = [];
  for (let i = 0; i <= 10; i++) {
    const t = i * 16;
    const extend = i <= 5 ? i / 5 : (10 - i) / 5; // 0 -> 1 -> 0
    frames.push({
      t,
      landmarks: makeLandmarks({
        rightWrist: { x: 0.6, y: 0.7 - extend * 0.3, visibility: 1 },
      }),
    });
  }
  return frames;
}

test("createArmTracker: tracks without throwing, snapshotAtImpact returns null or a sane sample", () => {
  const tracker = createArmTracker();
  for (const { landmarks, t } of punchSequence()) tracker.update(landmarks, t);
  const snap = tracker.snapshotAtImpact();
  if (snap !== null) {
    assert.ok(["left", "right"].includes(snap.side));
    assert.ok(snap.speed >= 0);
  }
});

test("summarizeSeed: needs at least 3 samples per side to seed", () => {
  assert.deepEqual(summarizeSeed([{ side: "left", speed: 1 }]), {});
  const seed = summarizeSeed([
    { side: "left", speed: 1 },
    { side: "left", speed: 2 },
    { side: "left", speed: 3 },
  ]);
  assert.equal(seed.left, 2);
});

test("createReactionTracker: getRel/getRecentPeakSpeed after a moving sequence", () => {
  const tracker = createReactionTracker();
  for (const { landmarks, t } of punchSequence()) tracker.update(landmarks, t);
  const rel = tracker.getRel("right");
  assert.ok(rel === null || (typeof rel.x === "number" && typeof rel.y === "number"));
  assert.ok(tracker.getRecentPeakSpeed("right") >= 0);
});

test("createHeadTracker: getRel/getRecentPeakSpeed after a moving sequence", () => {
  const tracker = createHeadTracker();
  for (let i = 0; i <= 10; i++) {
    tracker.update(makeLandmarks({ nose: { x: 0.5 + i * 0.01, y: 0.3, visibility: 1 } }), i * 16);
  }
  const rel = tracker.getRel();
  assert.ok(rel === null || (typeof rel.x === "number" && typeof rel.y === "number"));
  assert.ok(tracker.getRecentPeakSpeed() >= 0);
});

test("createPunchDetector: returns an events array every frame, doesn't throw over a punch sequence", () => {
  const detector = createPunchDetector();
  for (const { landmarks, t } of punchSequence()) {
    const events = detector.update(landmarks, t);
    assert.ok(Array.isArray(events));
  }
});

test("createPunchDetector: update(null, t) returns an empty array instead of throwing", () => {
  const detector = createPunchDetector();
  assert.deepEqual(detector.update(null, 0), []);
});

// Mobile-only divergence from web's copy (see MIGRATION_PLAN.md): a real
// punch's torso rotation shrinks the shared shoulder-width denominator
// both arms are normalized by, which can inflate the STATIONARY arm's
// apparent speed enough to also register as a punch. Simulates a real
// right-hand punch while the shoulders blade inward (shrinking width) and
// the left wrist stays put in absolute image space -- only the right
// punch should count.
function rightPunchWithBladingEcho() {
  const frames = [];
  const N = 30;
  for (let i = 0; i <= N; i++) {
    const t = i * 16;
    const extend = i <= N / 2 ? i / (N / 2) : (N - i) / (N / 2); // 0 -> 1 -> 0
    const halfWidth = (0.2 * (1 - extend * 0.5)) / 2; // shoulders blade inward mid-punch
    frames.push({
      t,
      landmarks: makeLandmarks({
        leftShoulder: { x: 0.5 - halfWidth, y: 0.5, visibility: 1 },
        rightShoulder: { x: 0.5 + halfWidth, y: 0.5, visibility: 1 },
        leftWrist: { x: 0.3, y: 0.7, visibility: 1 }, // not actually punching
        rightWrist: { x: 0.6, y: 0.7 - extend * 0.6, visibility: 1 },
      }),
    });
  }
  return frames;
}

// A genuine fast 1-2: both wrists throw a comparably strong, independent
// punch in the same short window, shoulders stationary -- this should
// NOT be suppressed just for being close in time to the other arm's.
function realOneTwoCombo() {
  const frames = [];
  const N = 30;
  for (let i = 0; i <= N; i++) {
    const t = i * 16;
    const extend = i <= N / 2 ? i / (N / 2) : (N - i) / (N / 2); // 0 -> 1 -> 0
    frames.push({
      t,
      landmarks: makeLandmarks({
        leftWrist: { x: 0.4, y: 0.7 - extend * 0.6, visibility: 1 },
        rightWrist: { x: 0.6, y: 0.7 - extend * 0.6, visibility: 1 },
      }),
    });
  }
  return frames;
}

test("createPunchDetector: a blading-induced echo on the stationary arm is suppressed", () => {
  const detector = createPunchDetector();
  const events = rightPunchWithBladingEcho().flatMap(({ landmarks, t }) => detector.update(landmarks, t));
  const punches = events.filter((e) => e.type === "punch");
  assert.ok(punches.some((e) => e.side === "right"), "the real right-hand punch should still be counted");
  assert.ok(!punches.some((e) => e.side === "left"), "the stationary left arm should not also be counted");
});

test("createPunchDetector: a genuine fast 1-2 (both arms comparably strong) is not suppressed", () => {
  const detector = createPunchDetector();
  const events = realOneTwoCombo().flatMap(({ landmarks, t }) => detector.update(landmarks, t));
  const sides = new Set(events.filter((e) => e.type === "punch").map((e) => e.side));
  assert.ok(sides.has("left") && sides.has("right"), "both arms of a real simultaneous combo should be counted");
});

test("rmsOf: silence is ~0, full-scale square wave is close to 1", () => {
  const silence = new Uint8Array(100).fill(128);
  assert.ok(rmsOf(silence) < 1e-9);
  const loud = new Uint8Array(100);
  for (let i = 0; i < loud.length; i++) loud[i] = i % 2 === 0 ? 0 : 255;
  assert.ok(rmsOf(loud) > 0.9);
});

test("rmsOfFloat32: silence is ~0, full-scale square wave is close to 1", () => {
  const silence = new Float32Array(100).fill(0);
  assert.ok(rmsOfFloat32(silence) < 1e-9);
  const loud = new Float32Array(100);
  for (let i = 0; i < loud.length; i++) loud[i] = i % 2 === 0 ? -1 : 1;
  assert.ok(rmsOfFloat32(loud) > 0.99);
});

test("rmsOfFloat32 and rmsOf agree on the same waveform in their respective encodings", () => {
  const floatSamples = new Float32Array([0, 0.5, -0.5, 0.25, -1, 1]);
  const byteSamples = Uint8Array.from(floatSamples, (v) => Math.round(v * 128 + 128));
  assert.ok(Math.abs(rmsOfFloat32(floatSamples) - rmsOf(byteSamples)) < 0.01);
});

test("createImpactDetector: stays quiet during bootstrap, then flags a real spike", () => {
  const detector = createImpactDetector();
  let hitDuringBootstrap = false;
  for (let i = 0; i < 8; i++) hitDuringBootstrap ||= detector.update(0.02, i * 10);
  assert.equal(hitDuringBootstrap, false);

  const spikeHit = detector.update(0.5, 1000);
  assert.equal(spikeHit, true);
});
