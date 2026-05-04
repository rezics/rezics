#!/usr/bin/env bun
/**
 * check-tokens.ts — contrast-invariant verification for rezics design tokens.
 *
 * Asserts (per openspec change `complete-rezics-token-system`, design.md
 * Decision 10):
 *   - Every surface ↔ on-surface pair clears 4.5:1 in light AND dark modes.
 *   - Every *-container ↔ on-*-container pair clears 4.5:1.
 *   - Every primary / error / warning / info / success ↔ on-* pair clears 4.5:1.
 *   - Every outline / outline-variant clears 3:1 against its target surface.
 *
 * Parses package/ui/src/config/tokens.css, resolves var() chains in both
 * modes, and computes WCAG 2.x contrast on sRGB hex literals (rgba is
 * composited onto the relevant surface before measurement). Exits 1 on any
 * violation.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TOKENS_PATH = resolve(
  import.meta.dir,
  "../../package/ui/src/config/tokens.css",
);

type Mode = "light" | "dark";
type RGB = { r: number; g: number; b: number; a: number };

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGBA_RE = /^rgba?\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i;

function parseColor(value: string): RGB | null {
  const v = value.trim();
  const hex = v.match(HEX_RE);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  const rgba = v.match(RGBA_RE);
  if (rgba) {
    return {
      r: clamp01(parseInt(rgba[1], 10) / 255),
      g: clamp01(parseInt(rgba[2], 10) / 255),
      b: clamp01(parseInt(rgba[3], 10) / 255),
      a: rgba[4] !== undefined ? clamp01(parseFloat(rgba[4])) : 1,
    };
  }
  return null;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function stripComments(input: string): string {
  let out = "";
  let i = 0;
  let inComment = false;
  while (i < input.length) {
    if (inComment) {
      if (input[i] === "*" && input[i + 1] === "/") {
        inComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (input[i] === "/" && input[i + 1] === "*") {
      inComment = true;
      i += 2;
      continue;
    }
    out += input[i];
    i++;
  }
  return out;
}

function compositeOver(fg: RGB, bg: RGB): RGB {
  const a = fg.a + bg.a * (1 - fg.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
    g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
    b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
    a,
  };
}

function relativeLuminance(c: RGB): number {
  const lin = (x: number) =>
    x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

function contrast(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [bright, dark] = la > lb ? [la, lb] : [lb, la];
  return (bright + 0.05) / (dark + 0.05);
}

/**
 * Parse tokens.css into two maps: the light/baseline declarations under the
 * top-level `.theme-rezics` block, and the dark-mode override block. Selectors
 * other than these are ignored. The parser is intentionally tiny — it only
 * needs to handle the structure we author, not arbitrary CSS.
 */
function parseTokens(css: string): {
  light: Map<string, string>;
  dark: Map<string, string>;
} {
  const light = new Map<string, string>();
  const dark = new Map<string, string>();

  // CSS does not allow nested block comments, so a single forward scan that
  // skips `/* … */` and `// …\n` regions yields a clean token stream. The
  // file's banner header contains `/* === LABEL */` pseudo-comments inside
  // the outer comment, which breaks naive regex stripping; the state machine
  // below sees them as just text inside the outer comment and ignores them.
  const blocks: Array<{ selector: string; body: string }> = [];
  let i = 0;
  let selectorStart = 0;
  let inComment = false;
  while (i < css.length) {
    if (inComment) {
      if (css[i] === "*" && css[i + 1] === "/") {
        inComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (css[i] === "/" && css[i + 1] === "*") {
      inComment = true;
      i += 2;
      continue;
    }
    if (css[i] === "{") {
      const selector = stripComments(css.slice(selectorStart, i)).trim();
      const open = i;
      let depth = 1;
      let j = i + 1;
      let inner = false;
      while (j < css.length && depth > 0) {
        if (inner) {
          if (css[j] === "*" && css[j + 1] === "/") {
            inner = false;
            j += 2;
            continue;
          }
          j++;
          continue;
        }
        if (css[j] === "/" && css[j + 1] === "*") {
          inner = true;
          j += 2;
          continue;
        }
        if (css[j] === "{") depth++;
        else if (css[j] === "}") {
          depth--;
          if (depth === 0) break;
        }
        j++;
      }
      blocks.push({ selector, body: css.slice(open + 1, j) });
      i = j + 1;
      selectorStart = i;
      continue;
    }
    if (css[i] === "}") {
      selectorStart = i + 1;
    }
    i++;
  }

  for (const { selector, body } of blocks) {
    // The selector slice may be polluted by file-level prelude (the banner
    // comment contains pseudo-comments that confuse spec-conformant comment
    // skipping). Take only the trailing selector-shaped tail after the last
    // statement terminator.
    const tail = selector
      .split(/[;}]/)
      .pop()!
      .replace(/\s+/g, " ")
      .trim();
    const isDark = tail.includes("[data-theme='dark']") ||
      tail.includes('[data-theme="dark"]') ||
      tail.includes("html.dark .theme-rezics");
    const isLight = !isDark && /(^|[\s,]).theme-rezics$/.test(tail);
    if (!isLight && !isDark) continue;
    const target = isDark ? dark : light;
    const cleanBody = stripComments(body);
    const declRe = /(--[\w-]+)\s*:\s*([^;{}]+);/g;
    let m: RegExpExecArray | null;
    while ((m = declRe.exec(cleanBody)) !== null) {
      target.set(m[1].trim(), m[2].trim());
    }
  }
  return { light, dark };
}

function resolveValue(
  name: string,
  mode: Mode,
  light: Map<string, string>,
  dark: Map<string, string>,
  seen = new Set<string>(),
): string | null {
  if (seen.has(name)) return null;
  seen.add(name);
  const raw = (mode === "dark" && dark.has(name) ? dark.get(name) : light.get(name)) ?? null;
  if (raw === null) return null;
  const varMatch = raw.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)$/);
  if (varMatch) {
    const resolved = resolveValue(varMatch[1], mode, light, dark, seen);
    if (resolved !== null) return resolved;
    if (varMatch[2]) return varMatch[2].trim();
    return null;
  }
  return raw;
}

function resolveColor(
  name: string,
  mode: Mode,
  light: Map<string, string>,
  dark: Map<string, string>,
): RGB | null {
  const value = resolveValue(name, mode, light, dark);
  if (!value) return null;
  return parseColor(value);
}

type Pair = {
  fg: string;
  bg: string;
  min: number;
  /** When fg is an alpha overlay (e.g., outline-variant), composite onto bg before measuring. */
  composite?: boolean;
  label?: string;
};

const SURFACE_PAIRS: Pair[] = [
  { fg: "--rezics-sys-color-on-surface", bg: "--rezics-sys-color-surface", min: 4.5 },
  { fg: "--rezics-sys-color-on-surface-variant", bg: "--rezics-sys-color-surface-variant", min: 4.5 },
  { fg: "--rezics-sys-color-on-surface", bg: "--rezics-sys-color-surface-container-lowest", min: 4.5 },
  { fg: "--rezics-sys-color-on-surface", bg: "--rezics-sys-color-surface-container-low", min: 4.5 },
  { fg: "--rezics-sys-color-on-surface", bg: "--rezics-sys-color-surface-container", min: 4.5 },
  { fg: "--rezics-sys-color-on-surface", bg: "--rezics-sys-color-surface-container-high", min: 4.5 },
  { fg: "--rezics-sys-color-on-surface", bg: "--rezics-sys-color-surface-container-highest", min: 4.5 },
  { fg: "--rezics-sys-color-inverse-on-surface", bg: "--rezics-sys-color-inverse-surface", min: 4.5 },
];

const ROLE_PAIRS: Pair[] = [
  { fg: "--rezics-sys-color-on-primary", bg: "--rezics-sys-color-primary", min: 4.5 },
  { fg: "--rezics-sys-color-on-secondary", bg: "--rezics-sys-color-secondary", min: 4.5 },
  { fg: "--rezics-sys-color-on-tertiary", bg: "--rezics-sys-color-tertiary", min: 4.5 },
  { fg: "--rezics-sys-color-on-success", bg: "--rezics-sys-color-success", min: 4.5 },
  { fg: "--rezics-sys-color-on-warning", bg: "--rezics-sys-color-warning", min: 4.5 },
  { fg: "--rezics-sys-color-on-error", bg: "--rezics-sys-color-error", min: 4.5 },
  { fg: "--rezics-sys-color-on-info", bg: "--rezics-sys-color-info", min: 4.5 },
];

const CONTAINER_PAIRS: Pair[] = [
  { fg: "--rezics-sys-color-on-primary-container", bg: "--rezics-sys-color-primary-container", min: 4.5 },
  { fg: "--rezics-sys-color-on-secondary-container", bg: "--rezics-sys-color-secondary-container", min: 4.5 },
  { fg: "--rezics-sys-color-on-tertiary-container", bg: "--rezics-sys-color-tertiary-container", min: 4.5 },
  { fg: "--rezics-sys-color-on-success-container", bg: "--rezics-sys-color-success-container", min: 4.5 },
  { fg: "--rezics-sys-color-on-warning-container", bg: "--rezics-sys-color-warning-container", min: 4.5 },
  { fg: "--rezics-sys-color-on-error-container", bg: "--rezics-sys-color-error-container", min: 4.5 },
  { fg: "--rezics-sys-color-on-info-container", bg: "--rezics-sys-color-info-container", min: 4.5 },
];

const OUTLINE_PAIRS: Pair[] = [
  { fg: "--rezics-sys-color-outline", bg: "--rezics-sys-color-surface", min: 3.0, composite: true },
  { fg: "--rezics-sys-color-outline-variant", bg: "--rezics-sys-color-surface", min: 3.0, composite: true },
];

const ALL_PAIRS: { group: string; pairs: Pair[] }[] = [
  { group: "surface ↔ on-surface (4.5:1)", pairs: SURFACE_PAIRS },
  { group: "role ↔ on-role (4.5:1)", pairs: ROLE_PAIRS },
  { group: "container ↔ on-container (4.5:1)", pairs: CONTAINER_PAIRS },
  { group: "outline ↔ surface (3:1, composited)", pairs: OUTLINE_PAIRS },
];

const css = readFileSync(TOKENS_PATH, "utf8");
const { light, dark } = parseTokens(css);

let failures = 0;
let checks = 0;
const results: string[] = [];

for (const { group, pairs } of ALL_PAIRS) {
  results.push(`\n${group}`);
  for (const pair of pairs) {
    for (const mode of ["light", "dark"] as const) {
      checks++;
      const fg = resolveColor(pair.fg, mode, light, dark);
      const bg = resolveColor(pair.bg, mode, light, dark);
      if (!fg || !bg) {
        failures++;
        results.push(
          `  [${mode.padEnd(5)}] FAIL  unresolved: ${pair.fg} / ${pair.bg}`,
        );
        continue;
      }
      const fgEffective = pair.composite || fg.a < 1 ? compositeOver(fg, bg) : fg;
      const ratio = contrast(fgEffective, bg);
      const ok = ratio >= pair.min;
      if (!ok) failures++;
      const tag = ok ? "PASS" : "FAIL";
      results.push(
        `  [${mode.padEnd(5)}] ${tag}  ${ratio.toFixed(2)}:1 (≥${pair.min})  ${pair.fg} on ${pair.bg}`,
      );
    }
  }
}

console.log(`Checked ${checks} pairs across light + dark.`);
console.log(results.join("\n"));

if (failures > 0) {
  console.error(`\n✗ ${failures} contrast violation(s).`);
  process.exit(1);
}
console.log(`\n✓ All ${checks} contrast checks pass.`);
