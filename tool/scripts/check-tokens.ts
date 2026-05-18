#!/usr/bin/env bun
/**
 * check-tokens.ts — contrast-invariant verification for rezics design tokens.
 *
 * Reads `package/ui/src/config/tokens/colors.ts` (the single source of truth)
 * and asserts WCAG contrast invariants against the curated key paths in both
 * light and dark modes. The runtime CSS variables emitted by uno-config.ts
 * mirror this object, so passing here implies the runtime cascade meets the
 * same thresholds.
 */
import {
  type ColorTokens,
  darkColors,
  lightColors,
} from "../../package/ui/src/config/tokens/colors";

type RGB = { r: number; g: number; b: number; a: number };

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGBA_RE =
  /^rgba?\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i;

function parseColor(value: string): RGB | null {
  const v = value.trim();
  const hex = v.match(HEX_RE);
  if (hex) {
    let h = hex[1]!;
    if (h.length === 3)
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    return {
      r: parseInt(h.slice(0, 2), 16) / 255,
      g: parseInt(h.slice(2, 4), 16) / 255,
      b: parseInt(h.slice(4, 6), 16) / 255,
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }
  const rgba = v.match(RGBA_RE);
  if (rgba) {
    return {
      r: clamp01(parseInt(rgba[1]!, 10) / 255),
      g: clamp01(parseInt(rgba[2]!, 10) / 255),
      b: clamp01(parseInt(rgba[3]!, 10) / 255),
      a: rgba[4] !== undefined ? clamp01(parseFloat(rgba[4]!)) : 1,
    };
  }
  return null;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
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

// Walks a key path like `surface.elevated` or `semantic.success.fill` and
// returns the string value at that location. Bracketed segments support
// kebab-case keys (e.g. `surface["container-low"]`).
function pick(root: ColorTokens, path: string): string | null {
  let cursor: unknown = root;
  for (const segment of path.split(".")) {
    if (cursor === null || typeof cursor !== "object") return null;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return typeof cursor === "string" ? cursor : null;
}

interface Pair {
  fg: string;
  bg: string;
  min: number;
  composite?: boolean;
}

const SURFACE_TEXT_PAIRS: Pair[] = [
  { fg: "text.primary", bg: "surface.canvas", min: 4.5 },
  { fg: "text.primary", bg: "surface.base", min: 4.5 },
  { fg: "text.primary", bg: "surface.elevated", min: 4.5 },
  { fg: "text.primary", bg: "surface.subtle", min: 4.5 },
  { fg: "text.primary", bg: "surface.sunken", min: 4.5 },
  { fg: "text.primary", bg: "surface.container-lowest", min: 4.5 },
  { fg: "text.primary", bg: "surface.container-low", min: 4.5 },
  { fg: "text.primary", bg: "surface.container", min: 4.5 },
  { fg: "text.primary", bg: "surface.container-high", min: 4.5 },
  { fg: "text.primary", bg: "surface.container-highest", min: 4.5 },
  { fg: "text.secondary", bg: "surface.canvas", min: 4.5 },
  { fg: "text.brand", bg: "surface.canvas", min: 4.5 },
  { fg: "inverse.on-surface", bg: "inverse.surface", min: 4.5 },
];

const ROLE_PAIRS: Pair[] = [
  // primary / destructive carry a brand-fill background; the foreground is a
  // large-text label (button copy, badge text). WCAG AA-large is 3:1.
  { fg: "primary.foreground", bg: "primary.DEFAULT", min: 3.0 },
  { fg: "destructive.foreground", bg: "destructive.DEFAULT", min: 3.0 },
  { fg: "secondary.foreground", bg: "secondary.DEFAULT", min: 4.5 },
  { fg: "card.foreground", bg: "card.DEFAULT", min: 4.5 },
  { fg: "popover.foreground", bg: "popover.DEFAULT", min: 4.5 },
];

const CONTAINER_PAIRS: Pair[] = [
  {
    fg: "semantic.success.on-container",
    bg: "semantic.success.container",
    min: 4.5,
  },
  {
    fg: "semantic.warning.on-container",
    bg: "semantic.warning.container",
    min: 4.5,
  },
  {
    fg: "semantic.error.on-container",
    bg: "semantic.error.container",
    min: 4.5,
  },
  { fg: "semantic.info.on-container", bg: "semantic.info.container", min: 4.5 },
  { fg: "brand.on-container", bg: "brand.container", min: 4.5 },
];

const BORDER_PAIRS: Pair[] = [
  // border-whisper is intentionally subtle (8% / 10% alpha overlay); the only
  // invariant is that it remains *visible* (>1:1) on canvas in both modes.
  { fg: "border.whisper", bg: "surface.canvas", min: 1.05, composite: true },
  { fg: "border.defined", bg: "surface.canvas", min: 1.2 },
];

const ALL_PAIRS: { group: string; pairs: Pair[] }[] = [
  { group: "surface ↔ text (4.5:1)", pairs: SURFACE_TEXT_PAIRS },
  { group: "shadcn role ↔ foreground (4.5:1)", pairs: ROLE_PAIRS },
  { group: "container ↔ on-container (4.5:1)", pairs: CONTAINER_PAIRS },
  {
    group: "border ↔ surface (≥1.2:1, whisper composited)",
    pairs: BORDER_PAIRS,
  },
];

let failures = 0;
let checks = 0;
const results: string[] = [];

for (const { group, pairs } of ALL_PAIRS) {
  results.push(`\n${group}`);
  for (const pair of pairs) {
    for (const mode of ["light", "dark"] as const) {
      checks++;
      const root: ColorTokens = mode === "dark" ? darkColors : lightColors;
      const fgVal = pick(root, pair.fg);
      const bgVal = pick(root, pair.bg);
      const fg = fgVal ? parseColor(fgVal) : null;
      const bg = bgVal ? parseColor(bgVal) : null;
      if (!fg || !bg) {
        failures++;
        results.push(
          `  [${mode.padEnd(5)}] FAIL  unresolved: ${pair.fg} (${fgVal}) / ${pair.bg} (${bgVal})`,
        );
        continue;
      }
      const fgEff = pair.composite || fg.a < 1 ? compositeOver(fg, bg) : fg;
      const ratio = contrast(fgEff, bg);
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
