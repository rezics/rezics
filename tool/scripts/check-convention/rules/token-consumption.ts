import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { REPO_ROOT } from "../core/paths";
import type { RuleScanner, Violation } from "../core/types";

const SPEC = "openspec/specs/ui-component-foundation/spec.md";

// Match any `--rezics-*` CSS variable reference. The whole namespace was
// retired by the unify-tokens-single-source openspec change; the flat
// `--colors-*` / `--radius-*` / `--shadow-*` / `--font-*` / `--duration-*` /
// `--easing-*` surface emitted by `package/ui/src/config/uno-config.ts` is the
// only sanctioned form.
const REZICS_VAR_PATTERN = /var\(\s*--rezics-[a-zA-Z0-9_-]+/;

// `package/ui/src/config/tokens.css` SHALL NOT exist — the tokens TS source is
// authoritative and uno-config.ts emits the runtime CSS variables.
const TOKENS_CSS_PATH = join(REPO_ROOT, "package/ui/src/config/tokens.css");

// SVG-inline / chart-fill exceptions. Each entry SHALL include a comment
// explaining why a UnoCSS shortcut cannot yet replace it. Reviewed quarterly;
// SHALL shrink over time.
const FILE_ALLOWLIST = new Set<string>([]);

function isTarget(absPath: string): boolean {
  const relPath = relative(REPO_ROOT, absPath).replace(/\\/g, "/");
  if (!/^package\/[^/]+\/src\//.test(relPath)) return false;
  if (!/\.(tsx?|jsx?|mdx|css)$/.test(relPath)) return false;
  if (/\.fixture\.[tj]sx?$/.test(relPath)) return false;
  return true;
}

export const tokenConsumptionRule: RuleScanner = {
  scan({ r9CandidateFiles }) {
    const violations: Violation[] = [];

    if (existsSync(TOKENS_CSS_PATH)) {
      violations.push({
        rule: "R9",
        path: "package/ui/src/config/tokens.css",
        message:
          "`tokens.css` is forbidden — design tokens live in `package/ui/src/config/tokens/*.ts` and are emitted as flat CSS variables by `uno-config.ts`. Delete this file.",
        spec: SPEC,
      });
    }

    for (const filePath of r9CandidateFiles) {
      if (!isTarget(filePath)) continue;
      const relPath = relative(REPO_ROOT, filePath).replace(/\\/g, "/");
      if (FILE_ALLOWLIST.has(relPath)) continue;

      let content: string;
      try {
        content = readFileSync(filePath, "utf8");
      } catch {
        continue;
      }

      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i]!.match(REZICS_VAR_PATTERN);
        if (match) {
          violations.push({
            rule: "R9",
            path: `${relPath}:${i + 1}`,
            message: `Forbidden \`${match[0]})\` — the \`--rezics-*\` namespace was retired. Use the flat CSS variable surface emitted by \`uno-config.ts\` (e.g. \`var(--colors-text-primary)\`, \`var(--radius-md)\`, \`var(--shadow-modal)\`) or the curated short-name className (\`text-primary\`, \`bg-surface-elevated\`).`,
            spec: SPEC,
          });
        }
      }
    }

    return violations;
  },
};
