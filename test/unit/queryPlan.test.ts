import { describe, expect, it } from "vitest";
import { createQueryPlan } from "../../src/core/query/anchorExtraction.js";

describe("query planner", () => {
  it("extracts anchors from a regex with broad gaps", () => {
    const plan = createQueryPlan("foo.*bar");

    expect(plan.requiresFullScan).toBe(false);
    expect(plan.extractableAnchors).toContain("foo");
    expect(plan.extractableAnchors).toContain("bar");
  });

  it("keeps alternation branches visible", () => {
    const plan = createQueryPlan("foo|bar");

    expect(plan.alternationBranches).toBe(2);
    expect(plan.branchAnchors[0]).toContain("foo");
    expect(plan.branchAnchors[1]).toContain("bar");
  });

  it("falls back for ignore-case regex planning", () => {
    const plan = createQueryPlan("token", "i");

    expect(plan.requiresFullScan).toBe(true);
    expect(plan.fallbackReason).toMatch(/Ignore-case/i);
  });
});
