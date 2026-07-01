import { describe, expect, it } from "vitest";
import {
  appSettingsUrl,
  appUrl,
  deriveGuestContext,
  newRecordUrl,
  recordUrl,
  viewUrl,
} from "../../src/kintone/url";

describe("deriveGuestContext", () => {
  it("returns /k for normal apps", () => {
    expect(deriveGuestContext("/k/12/")).toEqual({ prefix: "/k", spaceId: null });
  });

  it("returns the guest prefix and space id inside a guest space", () => {
    expect(deriveGuestContext("/k/guest/7/12/")).toEqual({
      prefix: "/k/guest/7",
      spaceId: "7",
    });
  });
});

describe("url builders (normal space)", () => {
  const ctx = { prefix: "/k", spaceId: null };
  it("builds app, view, record, new record, and settings urls", () => {
    expect(appUrl(ctx, 12)).toBe("/k/12/");
    expect(viewUrl(ctx, 12, 34)).toBe("/k/12/?view=34");
    expect(recordUrl(ctx, 12, 56)).toBe("/k/12/show#record=56");
    expect(newRecordUrl(ctx, 12)).toBe("/k/12/edit");
    expect(appSettingsUrl(ctx, 12)).toBe("/k/admin/app/flow?app=12");
  });
});

describe("url builders (guest space)", () => {
  const ctx = { prefix: "/k/guest/7", spaceId: "7" };
  it("prefixes every url with the guest space path", () => {
    expect(appUrl(ctx, 12)).toBe("/k/guest/7/12/");
    expect(viewUrl(ctx, 12, 34)).toBe("/k/guest/7/12/?view=34");
    expect(recordUrl(ctx, 12, 56)).toBe("/k/guest/7/12/show#record=56");
    expect(appSettingsUrl(ctx, 12)).toBe("/k/guest/7/admin/app/flow?app=12");
  });
});
