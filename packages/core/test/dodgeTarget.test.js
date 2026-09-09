import { test } from "node:test";
import assert from "node:assert/strict";
import { DODGE_ZONES, pickDodgeZone, isInZone } from "../src/dodgeTarget.js";

test("pickDodgeZone: never repeats the last key", () => {
  for (let i = 0; i < 50; i++) {
    const zone = pickDodgeZone("duck");
    assert.notEqual(zone.key, "duck");
  }
});

test("pickDodgeZone: with no lastKey, can return any zone", () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(pickDodgeZone(null).key);
  assert.equal(seen.size, DODGE_ZONES.length);
});

test("isInZone: slip-left only matches the left fraction of the frame", () => {
  const zone = DODGE_ZONES.find((z) => z.key === "slip-left");
  assert.equal(isInZone(zone, 0.1, 0.5), true);
  assert.equal(isInZone(zone, 0.5, 0.5), false);
});

test("isInZone: duck only matches the bottom fraction of the frame", () => {
  const zone = DODGE_ZONES.find((z) => z.key === "duck");
  assert.equal(isInZone(zone, 0.5, 0.9), true);
  assert.equal(isInZone(zone, 0.5, 0.5), false);
});
