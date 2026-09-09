import { test } from "node:test";
import assert from "node:assert/strict";
import { visible, dist, shoulderWidthOf, relWrist, relNose, MIN_VISIBILITY } from "../src/poseMath.js";
import { makeLandmarks } from "./helpers.js";

test("visible: true when no visibility field, false below MIN_VISIBILITY", () => {
  assert.equal(visible({ x: 0, y: 0 }), true);
  assert.equal(visible({ x: 0, y: 0, visibility: MIN_VISIBILITY }), true);
  assert.equal(visible({ x: 0, y: 0, visibility: MIN_VISIBILITY - 0.01 }), false);
  assert.equal(visible(null), false);
});

test("dist: Euclidean distance", () => {
  assert.equal(dist({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});

test("shoulderWidthOf: distance between shoulders when both visible", () => {
  const landmarks = makeLandmarks({
    leftShoulder: { x: 0.4, y: 0.5, visibility: 1 },
    rightShoulder: { x: 0.6, y: 0.5, visibility: 1 },
  });
  assert.ok(Math.abs(shoulderWidthOf(landmarks, 0.2) - 0.2) < 1e-9);
});

test("shoulderWidthOf: falls back when a shoulder is not visible", () => {
  const landmarks = makeLandmarks({ leftShoulder: { x: 0.4, y: 0.5, visibility: 0 } });
  assert.equal(shoulderWidthOf(landmarks, 0.33), 0.33);
});

test("shoulderWidthOf: falls back when landmarks is null", () => {
  assert.equal(shoulderWidthOf(null, 0.25), 0.25);
});

test("relWrist: normalized offset from same-side shoulder", () => {
  const landmarks = makeLandmarks({
    leftShoulder: { x: 0.4, y: 0.5, visibility: 1 },
    leftWrist: { x: 0.5, y: 0.7, visibility: 1 },
  });
  const rel = relWrist(landmarks, "left", 0.2);
  assert.ok(Math.abs(rel.x - 0.5) < 1e-9); // (0.5-0.4)/0.2
  assert.ok(Math.abs(rel.y - 1.0) < 1e-9); // (0.7-0.5)/0.2
});

test("relWrist: null when wrist not visible", () => {
  const landmarks = makeLandmarks({ leftWrist: { x: 0.5, y: 0.7, visibility: 0 } });
  assert.equal(relWrist(landmarks, "left", 0.2), null);
});

test("relNose: offset from shoulder midpoint", () => {
  const landmarks = makeLandmarks({
    nose: { x: 0.5, y: 0.3, visibility: 1 },
    leftShoulder: { x: 0.4, y: 0.5, visibility: 1 },
    rightShoulder: { x: 0.6, y: 0.5, visibility: 1 },
  });
  const rel = relNose(landmarks, 0.2);
  assert.ok(Math.abs(rel.x - 0) < 1e-9); // midpoint x is 0.5, same as nose
  assert.ok(Math.abs(rel.y - -1.0) < 1e-9); // (0.3-0.5)/0.2
});
