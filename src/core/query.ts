// Build the kintone REST `query` string for record like search (FR-6).
// kintone independent so it can be unit tested.

const RECORD_LIMIT = 20;

// Escape a keyword for use inside a double-quoted like value: backslash first,
// then the double quote (EC-11).
export function escapeLikeValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Build the like query for the given raw keyword and target field codes.
 * Terms are split on whitespace; each term ORs across all fields and the terms
 * are ANDed together. Returns an empty string when there is no term or field
 * (the caller then skips the request).
 *
 * Example (2 terms x 3 fields):
 *   (f1 like "t1" or f2 like "t1" or f3 like "t1") and
 *   (f1 like "t2" or f2 like "t2" or f3 like "t2") order by $id desc limit 20
 */
export function buildLikeQuery(rawQuery: string, fields: readonly string[]): string {
  const terms = rawQuery
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (terms.length === 0 || fields.length === 0) {
    return "";
  }

  const clauses = terms.map((term) => {
    const value = escapeLikeValue(term);
    const ors = fields.map((f) => `${f} like "${value}"`).join(" or ");
    return `(${ors})`;
  });

  return `${clauses.join(" and ")} order by $id desc limit ${RECORD_LIMIT}`;
}
