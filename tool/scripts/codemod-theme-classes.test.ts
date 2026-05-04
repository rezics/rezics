/**
 * Smoke test for codemod-theme-classes. Covers:
 *   (a) exact-map substitution
 *   (b) cn() argument substitution
 *   (c) template-literal static-segment substitution
 *   (d) skipped dynamic-interpolation case (must not be auto-rewritten)
 *   (e) idempotency
 *   (f) word-boundary safety (a longer name that ends in a map key must not be rewritten)
 */

import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const SCRIPT = new URL("./codemod-theme-classes.ts", import.meta.url).pathname;

function runCodemod(args: string[]): { code: number; stdout: string; stderr: string } {
  const r = spawnSync("bun", [SCRIPT, ...args], { encoding: "utf8" });
  return { code: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function makeFile(dir: string, name: string, content: string): string {
  const p = join(dir, name);
  writeFileSync(p, content, "utf8");
  return p;
}

describe("codemod-theme-classes", () => {
  it("(a) substitutes an exact-map class inside a className string", () => {
    const tmp = mkdtempSync(join(tmpdir(), "codemod-a-"));
    const f = makeFile(
      tmp,
      "X.tsx",
      `export const X = () => <div className="text-rezics-color-fg-muted text-sm" />;\n`,
    );
    const r = runCodemod(["--apply", tmp]);
    expect(r.code).toBe(0);
    const out = readFileSync(f, "utf8");
    expect(out).toContain("text-text-secondary text-sm");
    expect(out).not.toContain("text-rezics-color-fg-muted");
    rmSync(tmp, { recursive: true, force: true });
  });

  it("(b) substitutes inside cn() arguments", () => {
    const tmp = mkdtempSync(join(tmpdir(), "codemod-b-"));
    const f = makeFile(
      tmp,
      "X.tsx",
      `import { cn } from "x";
export const X = ({ muted }: { muted: boolean }) => (
  <div className={cn("text-base", muted && "text-rezics-color-fg-muted")} />
);\n`,
    );
    const r = runCodemod(["--apply", tmp]);
    expect(r.code).toBe(0);
    const out = readFileSync(f, "utf8");
    expect(out).toContain("text-text-secondary");
    expect(out).not.toContain("rezics-color-fg-muted");
    rmSync(tmp, { recursive: true, force: true });
  });

  it("(c) substitutes inside a template-literal static segment", () => {
    const tmp = mkdtempSync(join(tmpdir(), "codemod-c-"));
    const f = makeFile(
      tmp,
      "X.tsx",
      `export const X = ({ size }: { size: string }) => (
  <div className={\`bg-rezics-color-bg \${size}\`} />
);\n`,
    );
    const r = runCodemod(["--apply", tmp]);
    expect(r.code).toBe(0);
    const out = readFileSync(f, "utf8");
    expect(out).toContain("bg-surface-canvas");
    expect(out).not.toContain("bg-rezics-color-bg");
    rmSync(tmp, { recursive: true, force: true });
  });

  it("(d) does NOT auto-rewrite a dynamic-interpolation case where the name is built at runtime", () => {
    // Pure dynamic construction (`text-${variant}-rezics-color-${shade}`) — the
    // codemod cannot know what `variant` and `shade` resolve to. The map-key
    // string never appears as a static literal, so substitution skips it.
    const tmp = mkdtempSync(join(tmpdir(), "codemod-d-"));
    const f = makeFile(
      tmp,
      "X.tsx",
      `export const X = ({ shade }: { shade: string }) => (
  <div className={\`text-\${shade}-rezics-color-fg\`} />
);\n`,
    );
    const orig = readFileSync(f, "utf8");
    const r = runCodemod(["--apply", tmp]);
    expect(r.code).toBe(0);
    const after = readFileSync(f, "utf8");
    // The static segment "rezics-color-fg" inside the template never forms a
    // bare matchable className token (always preceded by a `${...}`), so the
    // word-boundary regex skips it.
    expect(after).toBe(orig);

    // --report-skipped should surface this site
    const rep = runCodemod(["--report-skipped", tmp]);
    expect(rep.stdout).toContain("dynamic-template");
    rmSync(tmp, { recursive: true, force: true });
  });

  it("(e) is idempotent — second run produces no further changes", () => {
    const tmp = mkdtempSync(join(tmpdir(), "codemod-e-"));
    const f = makeFile(
      tmp,
      "X.tsx",
      `export const X = () => <div className="text-rezics-color-fg" />;\n`,
    );
    runCodemod(["--apply", tmp]);
    const after1 = readFileSync(f, "utf8");
    runCodemod(["--apply", tmp]);
    const after2 = readFileSync(f, "utf8");
    expect(after2).toBe(after1);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("(f) word-boundary: does not rewrite when the map key is a substring of a longer identifier", () => {
    const tmp = mkdtempSync(join(tmpdir(), "codemod-f-"));
    const f = makeFile(
      tmp,
      "X.tsx",
      // text-rezics-color-fg-muted is a map key; text-rezics-color-fg-muteddd is not.
      `export const X = () => <div data-test="text-rezics-color-fg-muteddd" />;\n`,
    );
    const orig = readFileSync(f, "utf8");
    runCodemod(["--apply", tmp]);
    const after = readFileSync(f, "utf8");
    expect(after).toBe(orig);
    rmSync(tmp, { recursive: true, force: true });
  });
});
