import test from "node:test";
import assert from "node:assert/strict";
import { planVerticalLine } from "../dist/renderer/vertical-layout.js";

const body = { id: "body", band: "body", x1: 0, x2: 20, height: 24, fixed: true };

test("vertical planner reuses height for disjoint intervals", () => {
  const plan = planVerticalLine([
    body,
    { id: "left", band: "ornament", x1: 0, x2: 10, height: 12, gap: 4 },
    { id: "right", band: "ornament", x1: 30, x2: 40, height: 12, gap: 4 },
  ]);
  assert.equal(plan.placements.get("left").bottom, 28);
  assert.equal(plan.placements.get("right").bottom, 0);
  assert.equal(plan.collisions.length, 0);
});

test("vertical planner follows semantic band order for collisions", () => {
  const plan = planVerticalLine([
    body,
    { id: "nav", band: "navigation", x1: 0, x2: 20, height: 20, gap: 4 },
    { id: "ornament", band: "ornament", x1: 0, x2: 20, height: 22, gap: 4 },
    { id: "tie", band: "tie", x1: 0, x2: 20, height: 16, gap: 4 },
  ]);
  assert.ok(plan.placements.get("tie").bottom >= plan.placements.get("body").top + 4);
  assert.ok(plan.placements.get("ornament").bottom >= plan.placements.get("tie").top + 4);
  assert.ok(plan.placements.get("nav").bottom >= plan.placements.get("ornament").top + 4);
  assert.equal(plan.collisions.length, 0);
});

test("vertical planner packs same-band spans into deterministic lanes", () => {
  const items = [
    { id: "outer", band: "slur", x1: 0, x2: 50, height: 20, gap: 4, dependsOn: ["inner"] },
    { id: "inner", band: "slur", x1: 10, x2: 40, height: 20, gap: 4 },
  ];
  const first = planVerticalLine(items);
  const second = planVerticalLine([...items].reverse());
  assert.equal(first.placements.get("inner").lane, 0);
  assert.equal(first.placements.get("outer").lane, 1);
  assert.deepEqual([...first.placements], [...second.placements]);
  assert.equal(first.collisions.length, 0);
});

test("vertical planner uses source order before stable ids", () => {
  const plan = planVerticalLine([
    { id: "alphabetically-first", band: "ornament", x1: 0, x2: 20, height: 10, gap: 4, sourceOrder: 20 },
    { id: "alphabetically-last", band: "ornament", x1: 0, x2: 20, height: 10, gap: 4, sourceOrder: 10 },
  ]);
  assert.equal(plan.placements.get("alphabetically-last").lane, 0);
  assert.equal(plan.placements.get("alphabetically-first").lane, 1);
});

test("vertical planner keeps every pairwise upper-band combination collision free", () => {
  const bands = ["tie", "ornament", "velocity", "hairpin", "slur", "ending", "navigation"];
  for (const [leftIndex, leftBand] of bands.entries()) {
    for (const [rightIndex, rightBand] of bands.entries()) {
      if (rightIndex <= leftIndex) {
        continue;
      }
      const plan = planVerticalLine([
        body,
        { id: leftBand, band: leftBand, x1: 0, x2: 20, height: 10, gap: 4, sourceOrder: 1 },
        { id: rightBand, band: rightBand, x1: 0, x2: 20, height: 10, gap: 4, sourceOrder: 2 },
      ]);
      assert.equal(plan.collisions.length, 0, `${leftBand} and ${rightBand} should not collide`);
      assert.ok(
        plan.placements.get(rightBand).bottom >= plan.placements.get(leftBand).top + 4,
        `${rightBand} should be outside ${leftBand}`,
      );
    }
  }
});

test("vertical planner rejects missing and cyclic dependencies", () => {
  assert.throws(() => planVerticalLine([{ id: "a", band: "slur", x1: 0, x2: 1, height: 1, dependsOn: ["missing"] }]), /missing/);
  assert.throws(
    () => planVerticalLine([
      { id: "a", band: "slur", x1: 0, x2: 1, height: 1, dependsOn: ["b"] },
      { id: "b", band: "slur", x1: 0, x2: 1, height: 1, dependsOn: ["a"] },
    ]),
    /cycle/,
  );
});
