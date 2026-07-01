import { describe, expect, it } from "vitest";
import { matchList, normalize, scoreTerm } from "../../src/core/match";

const byName = (s: string) => s;

describe("normalize", () => {
  it("applies NFKC, lowercase, and katakana to hiragana", () => {
    expect(normalize("Ｋｉｎｔｏｎｅ")).toBe("kintone");
    expect(normalize("カタカナ")).toBe("かたかな");
    expect(normalize("ﾊﾝｶｸ")).toBe("はんかく");
  });
});

describe("matchList", () => {
  it("TC-1: katakana candidate matches hiragana query", () => {
    const result = matchList("かたかな", ["カタカナ", "無関係"], byName);
    expect(result).toContain("カタカナ");
    expect(result).not.toContain("無関係");
  });

  it("TC-2: full-width alphanumerics match ascii query (NFKC + lowercase)", () => {
    const result = matchList("kintone", ["Ｋｉｎｔｏｎｅ", "その他"], byName);
    expect(result[0]).toBe("Ｋｉｎｔｏｎｅ");
  });

  it("TC-3: ranks prefix and shorter names first", () => {
    const result = matchList("顧客", ["顧客管理", "販売顧客", "顧客"], byName);
    expect(result).toEqual(["顧客", "顧客管理", "販売顧客"]);
  });

  it("TC-5: AND across terms excludes partial matches", () => {
    const result = matchList("顧客 東京", ["顧客管理", "東京顧客リスト"], byName);
    expect(result).toEqual(["東京顧客リスト"]);
  });

  it("TC-6: empty query returns all candidates in original order", () => {
    const items = ["b", "a", "c"];
    expect(matchList("", items, byName)).toEqual(items);
    expect(matchList("   ", items, byName)).toEqual(items);
  });
});

describe("scoreTerm", () => {
  it("TC-4: word-head match scores 80", () => {
    expect(scoreTerm("report", "sales-report")).toBe(80);
  });

  it("prefix scores 100, substring scores 60, no match scores 0", () => {
    expect(scoreTerm("sales", "sales-report")).toBe(100);
    expect(scoreTerm("ales", "sales-report")).toBe(60);
    expect(scoreTerm("zzz", "sales-report")).toBe(0);
  });

  it("treats camelCase boundaries as word heads", () => {
    expect(scoreTerm("report", "salesReport")).toBe(80);
  });
});
