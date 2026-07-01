import { describe, expect, it } from "vitest";
import { cycleFilter, moveSelection } from "../../src/core/state";
import type { SourceKey } from "../../src/core/types";

const allEnabled: Record<SourceKey, boolean> = {
  apps: true,
  views: true,
  records: true,
  actions: true,
};

describe("moveSelection", () => {
  it("TC-11: wraps from the last item to the first", () => {
    expect(moveSelection(4, 5, 1)).toBe(0);
  });

  it("wraps from the first item to the last", () => {
    expect(moveSelection(0, 5, -1)).toBe(4);
  });

  it("returns -1 when there is nothing to select", () => {
    expect(moveSelection(0, 0, 1)).toBe(-1);
  });
});

describe("cycleFilter", () => {
  it("cycles all -> actions -> views -> apps -> records -> all", () => {
    const seq: string[] = [];
    let f = cycleFilter("all", allEnabled, 1);
    for (let i = 0; i < 5; i += 1) {
      seq.push(f);
      f = cycleFilter(f, allEnabled, 1);
    }
    expect(seq).toEqual(["actions", "views", "apps", "records", "all"]);
  });

  it("TC-12: skips a disabled source (views off)", () => {
    const enabled = { ...allEnabled, views: false };
    const seq: string[] = [];
    let f: ReturnType<typeof cycleFilter> = "all";
    for (let i = 0; i < 4; i += 1) {
      f = cycleFilter(f, enabled, 1);
      seq.push(f);
    }
    expect(seq).toEqual(["actions", "apps", "records", "all"]);
  });

  it("steps backwards with direction -1", () => {
    expect(cycleFilter("all", allEnabled, -1)).toBe("records");
  });
});
