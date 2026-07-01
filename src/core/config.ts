import { z } from "zod";
import type { Settings } from "./types";

// Plugin settings schema and (de)serialization (CF-1..CF-6, section 5). Values
// are stored as one JSON string under the "config" key with a version number.

export const DEFAULT_SETTINGS: Settings = {
  shortcut: "ctrl-k",
  sources: { apps: true, views: true, records: true, actions: true },
  recordSearchFields: [],
};

const sourcesSchema = z.object({
  apps: z.boolean(),
  views: z.boolean(),
  records: z.boolean(),
  actions: z.boolean(),
});

const settingsSchema = z
  .object({
    shortcut: z.enum(["ctrl-k", "ctrl-shift-k", "disabled"]),
    sources: sourcesSchema,
    recordSearchFields: z.array(z.string()).max(3),
  })
  .superRefine((s, ctx) => {
    // No duplicate field codes (EC-11 is escaping; this is the settings rule).
    if (new Set(s.recordSearchFields).size !== s.recordSearchFields.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate recordSearchFields" });
    }
    // Record search on requires at least one field (EC-17).
    if (s.sources.records && s.recordSearchFields.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "recordSearchFields required" });
    }
  });

const configSchema = z.object({
  version: z.literal(1),
  settings: settingsSchema,
});

/**
 * Parse the stored config JSON into Settings. Any failure (missing key, wrong
 * version, out-of-range value, unparseable JSON, cross-field violation) returns
 * null, which the runtime treats as "not configured" and does nothing (common
 * spec section 4).
 */
export function parseConfig(configString: string | undefined | null): Settings | null {
  if (!configString) return null;
  let data: unknown;
  try {
    data = JSON.parse(configString);
  } catch {
    return null;
  }
  const result = configSchema.safeParse(data);
  return result.success ? result.data.settings : null;
}

/** Serialize settings to the JSON string stored under the single "config" key. */
export function serializeConfig(settings: Settings): string {
  return JSON.stringify({ version: 1, settings });
}
