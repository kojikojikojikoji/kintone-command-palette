import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseConfig, serializeConfig } from "../../src/core/config";
import type { Settings } from "../../src/core/types";

function config(settings: Partial<Settings>): string {
  return JSON.stringify({
    version: 1,
    settings: { ...DEFAULT_SETTINGS, ...settings },
  });
}

describe("parseConfig", () => {
  it("returns null for empty or invalid JSON", () => {
    expect(parseConfig(undefined)).toBeNull();
    expect(parseConfig("")).toBeNull();
    expect(parseConfig("{broken")).toBeNull();
  });

  it("round-trips valid settings", () => {
    const settings: Settings = {
      shortcut: "ctrl-shift-k",
      sources: { apps: true, views: false, records: false, actions: true },
      recordSearchFields: [],
    };
    expect(parseConfig(serializeConfig(settings))).toEqual(settings);
  });

  it("TC-13: rejects more than three record search fields", () => {
    expect(parseConfig(config({ recordSearchFields: ["a", "b", "c", "d"] }))).toBeNull();
  });

  it("TC-14: rejects an unknown shortcut value", () => {
    const raw = JSON.stringify({
      version: 1,
      settings: { ...DEFAULT_SETTINGS, shortcut: "ctrl-j" },
    });
    expect(parseConfig(raw)).toBeNull();
  });

  it("EC-17: rejects records on with no fields", () => {
    expect(
      parseConfig(
        config({
          sources: { apps: true, views: true, records: true, actions: true },
          recordSearchFields: [],
        }),
      ),
    ).toBeNull();
  });

  it("rejects duplicate record search fields", () => {
    expect(
      parseConfig(
        config({
          sources: { apps: true, views: true, records: true, actions: true },
          recordSearchFields: ["a", "a"],
        }),
      ),
    ).toBeNull();
  });

  it("wrong version fails", () => {
    expect(parseConfig(JSON.stringify({ version: 2, settings: DEFAULT_SETTINGS }))).toBeNull();
  });
});
