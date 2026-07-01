import { describe, expect, it } from "vitest";
import { buildLikeQuery, escapeLikeValue } from "../../src/core/query";

describe("escapeLikeValue", () => {
  it("escapes backslash and double quote", () => {
    expect(escapeLikeValue('a"b\\c')).toBe('a\\"b\\\\c');
  });
});

describe("buildLikeQuery", () => {
  it("TC-7: escapes quotes and backslashes in the value", () => {
    const q = buildLikeQuery('a"b\\c', ["f1", "f2"]);
    expect(q).toBe('(f1 like "a\\"b\\\\c" or f2 like "a\\"b\\\\c") order by $id desc limit 20');
  });

  it("TC-8: two terms across three fields join with and, ordered", () => {
    const q = buildLikeQuery("tokyo osaka", ["f1", "f2", "f3"]);
    expect(q).toBe(
      '(f1 like "tokyo" or f2 like "tokyo" or f3 like "tokyo") and ' +
        '(f1 like "osaka" or f2 like "osaka" or f3 like "osaka") order by $id desc limit 20',
    );
  });

  it("returns an empty string when there is no term or field", () => {
    expect(buildLikeQuery("", ["f1"])).toBe("");
    expect(buildLikeQuery("x", [])).toBe("");
  });
});
