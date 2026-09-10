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
