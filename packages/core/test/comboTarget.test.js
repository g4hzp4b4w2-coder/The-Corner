import { test } from "node:test";
import assert from "node:assert/strict";
import { COMBOS, pickCombo, matchesStep } from "../src/comboTarget.js";

test("pickCombo: never repeats the last key", () => {
  for (let i = 0; i < 50; i++) {
    const combo = pickCombo("left-hook");
    assert.notEqual(combo.key, "left-hook");
  }
});

test("pickCombo: with no lastKey, can return any combo", () => {
  const seen = new Set();
  for (let i = 0; i < 300; i++) seen.add(pickCombo(null).key);
  assert.equal(seen.size, COMBOS.length);
});

test("matchesStep: true only for a punch event matching side+style", () => {
  const step = { side: "left", style: "hook" };
  assert.equal(matchesStep(step, { type: "punch", side: "left", style: "hook" }), true);
  assert.equal(matchesStep(step, { type: "punch", side: "right", style: "hook" }), false);
  assert.equal(matchesStep(step, { type: "punch", side: "left", style: "straight" }), false);
  assert.equal(matchesStep(step, { type: "guard-drop", side: "left", style: "hook" }), false);
});

test("every combo's steps are individually addressable by side+style", () => {
  for (const combo of COMBOS) {
    for (const step of combo.steps) {
      assert.ok(["left", "right"].includes(step.side));
      assert.ok(["straight", "hook", "uppercut"].includes(step.style));
    }
  }
});
