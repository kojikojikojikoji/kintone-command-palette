// Shared types for the core (kintone-independent) logic.

export type ShortcutKey = "ctrl-k" | "ctrl-shift-k" | "disabled";

export type SourceKey = "apps" | "views" | "records" | "actions";

export type SourceFilter = "all" | "actions" | "views" | "apps" | "records";

export interface Sources {
  apps: boolean;
  views: boolean;
  records: boolean;
  actions: boolean;
}

export interface Settings {
  shortcut: ShortcutKey;
  sources: Sources;
  recordSearchFields: string[];
}

// A single row in the recent-items history (FR-9).
export interface RecentItem {
  type: string;
  id: string;
  label: string;
  subLabel: string;
  url: string;
  lastUsedAt: number;
}
