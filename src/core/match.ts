// Fuzzy match for apps, views, and actions (FR-3). No external library.
//
// Scoring, per requirement:
//   - normalize query and candidate: NFKC, lowercase, katakana -> hiragana
//   - split the query on spaces; every term must match (AND)
//   - term score: prefix 100, word-head 80, substring 60, no match 0
//   - candidate score = sum of term scores
//   - order: score desc, then shorter name, then original order (stable)

const KATAKANA_START = 0x30a1;
const KATAKANA_END = 0x30f6;
const KANA_SHIFT = 0x60;

// NFKC + katakana->hiragana, keeping the original case. Case is needed to detect
// camelCase word heads; the case-insensitive form is derived by lowercasing this
// so both stay index-aligned.
function nfkcKana(input: string): string {
  const nfkc = input.normalize("NFKC");
  let out = "";
  for (const ch of nfkc) {
    const code = ch.codePointAt(0) as number;
    if (code >= KATAKANA_START && code <= KATAKANA_END) {
      out += String.fromCodePoint(code - KANA_SHIFT);
    } else {
      out += ch;
    }
  }
  return out;
}

/** Full normalization used for matching: NFKC, lowercase, katakana -> hiragana. */
export function normalize(input: string): string {
  return nfkcKana(input).toLowerCase();
}

const WORD_HEAD_SEPARATORS = new Set([" ", "-", "_", "/"]);

function isAsciiLower(code: number): boolean {
  return code >= 0x61 && code <= 0x7a;
}

function isAsciiUpper(code: number): boolean {
  return code >= 0x41 && code <= 0x5a;
}

// Indices in `cased` that count as a word head: string start, the position right
// after a space / - / _ / /, and an ASCII lowercase -> uppercase boundary.
function wordHeadIndices(cased: string): Set<number> {
  const heads = new Set<number>();
  const chars = Array.from(cased);
  for (let i = 0; i < chars.length; i += 1) {
    if (i === 0) {
      heads.add(0);
      continue;
    }
    const prev = chars[i - 1];
    if (WORD_HEAD_SEPARATORS.has(prev)) {
      heads.add(i);
      continue;
    }
    const prevCode = prev.codePointAt(0) as number;
    const curCode = chars[i].codePointAt(0) as number;
    if (isAsciiLower(prevCode) && isAsciiUpper(curCode)) {
      heads.add(i);
    }
  }
  return heads;
}

/**
 * Score one normalized term against a candidate name.
 * Returns 100 (prefix), 80 (word head), 60 (substring), or 0 (no match).
 */
export function scoreTerm(term: string, name: string): number {
  if (term === "") return 0;
  const cased = nfkcKana(name);
  const lower = cased.toLowerCase();
  if (lower.startsWith(term)) return 100;

  const heads = wordHeadIndices(cased);
  const lowerChars = Array.from(lower);
  for (const head of heads) {
    if (head === 0) continue; // a head-0 match would already be a prefix
    const slice = lowerChars.slice(head, head + Array.from(term).length).join("");
    if (slice === term) return 80;
  }

  if (lower.includes(term)) return 60;
  return 0;
}

interface Ranked<T> {
  item: T;
  score: number;
  length: number;
  index: number;
}

/**
 * Filter and rank candidates by the query. An empty query returns every
 * candidate in the original order.
 */
export function matchList<T>(
  query: string,
  items: readonly T[],
  getName: (item: T) => string,
): T[] {
  const terms = normalize(query)
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (terms.length === 0) {
    return items.slice();
  }

  const ranked: Ranked<T>[] = [];
  items.forEach((item, index) => {
    const name = getName(item);
    let total = 0;
    let matchedAll = true;
    for (const term of terms) {
      const s = scoreTerm(term, name);
      if (s === 0) {
        matchedAll = false;
        break;
      }
      total += s;
    }
    if (matchedAll) {
      ranked.push({ item, score: total, length: Array.from(name).length, index });
    }
  });

  ranked.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.length !== b.length) return a.length - b.length;
    return a.index - b.index;
  });

  return ranked.map((r) => r.item);
}
