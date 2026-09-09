import { test } from "node:test";
import assert from "node:assert/strict";
import { PAD_TARGETS, pickTarget, checkTarget, HIT_RADIUS, MIN_HIT_SPEED } from "../src/reactionTarget.js";

test("pickTarget: never repeats the last key", () => {
  for (let i = 0; i < 50; i++) {
    const target = pickTarget("left-high");
    assert.notEqual(target.key, "left-high");
  }
});

test("checkTarget: hit when close enough and moving fast enough", () => {
  const target = { ...PAD_TARGETS[0], timeoutAt: Date.now() + 1000 };
  const rel = { x: target.rel.x + 0.01, y: target.rel.y };
  assert.equal(checkTarget(target, rel, MIN_HIT_SPEED + 0.1, Date.now()), "hit");
});

test("checkTarget: not a hit when close but not moving fast enough", () => {
  const target = { ...PAD_TARGETS[0], timeoutAt: Date.now() + 1000 };
  const rel = { x: target.rel.x, y: target.rel.y };
  assert.equal(checkTarget(target, rel, MIN_HIT_SPEED - 0.1, Date.now()), null);
});

test("checkTarget: not a hit when moving fast but too far from target", () => {
  const target = { ...PAD_TARGETS[0], timeoutAt: Date.now() + 1000 };
  const rel = { x: target.rel.x + HIT_RADIUS + 0.5, y: target.rel.y };
  assert.equal(checkTarget(target, rel, MIN_HIT_SPEED + 1, Date.now()), null);
});

test("checkTarget: miss once the timeout has passed with no hit", () => {
  const target = { ...PAD_TARGETS[0], timeoutAt: Date.now() - 1 };
  assert.equal(checkTarget(target, null, 0, Date.now()), "miss");
});
