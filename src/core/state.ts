import type { SourceFilter, SourceKey } from "./types";

// Selection and source-filter state transitions (FR-2, FR-8). kintone
// independent.

// Tab cycles through this order, skipping disabled source filters. "all" is
// always present.
const FILTER_ORDER: SourceFilter[] = ["all", "actions", "views", "apps", "records"];

/**
 * Move the selection index by delta with wrap-around over `count` selectable
 * rows. Returns -1 when there is nothing to select.
 */
export function moveSelection(current: number, count: number, delta: number): number {
  if (count <= 0) return -1;
  const base = current < 0 ? 0 : current;
  return (base + delta + count) % count;
}

/**
 * Advance the source filter by one step (Tab = +1, Shift+Tab = -1), skipping
 * any single-source filter whose source is disabled.
 */
export function cycleFilter(
  current: SourceFilter,
  enabled: Record<SourceKey, boolean>,
  direction: 1 | -1,
): SourceFilter {
  const n = FILTER_ORDER.length;
  let idx = FILTER_ORDER.indexOf(current);
  if (idx < 0) idx = 0;
  for (let step = 0; step < n; step += 1) {
    idx = (idx + direction + n) % n;
    const filter = FILTER_ORDER[idx];
    if (filter === "all" || enabled[filter as SourceKey]) {
      return filter;
    }
  }
  return "all";
}
