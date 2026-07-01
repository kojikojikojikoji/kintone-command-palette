import { describe, expect, it } from "vitest";
import { addRecent, parseRecent, RECENT_MAX } from "../../src/core/recent";
import type { RecentItem } from "../../src/core/types";

function makeItem(n: number): RecentItem {
  return {
    type: "app",
    id: String(n),
    label: `app ${n}`,
    subLabel: "",
    url: `/k/${n}/`,
    lastUsedAt: n,
  };
}

describe("addRecent", () => {
  it("TC-9: keeps at most 20 items, dropping the oldest", () => {
    const list = Array.from({ length: RECENT_MAX }, (_, i) => makeItem(i));
    const next = addRecent(
      list,
      { type: "app", id: "new", label: "new", subLabel: "", url: "/k/new/" },
      999,
    );
    expect(next).toHaveLength(RECENT_MAX);
    expect(next[0].id).toBe("new");
    // The tail (oldest in list order) is dropped; the newest survivors remain.
    expect(next.some((r) => r.id === String(RECENT_MAX - 1))).toBe(false);
    expect(next.some((r) => r.id === "0")).toBe(true);
  });

  it("TC-10: dedupes by type+id and moves the item to the front", () => {
    const list = [makeItem(1), makeItem(2), makeItem(3)];
    const next = addRecent(
      list,
      { type: "app", id: "2", label: "app 2 updated", subLabel: "", url: "/k/2/" },
      500,
    );
    expect(next.filter((r) => r.type === "app" && r.id === "2")).toHaveLength(1);
    expect(next[0].id).toBe("2");
    expect(next[0].label).toBe("app 2 updated");
    expect(next).toHaveLength(3);
  });
});

describe("parseRecent", () => {
  it("returns an empty list for missing or invalid data", () => {
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent("{not json")).toEqual([]);
    expect(parseRecent(JSON.stringify([{ type: "app" }]))).toEqual([]);
  });

  it("round-trips valid data", () => {
    const list = [makeItem(1)];
    expect(parseRecent(JSON.stringify(list))).toEqual(list);
  });
});
