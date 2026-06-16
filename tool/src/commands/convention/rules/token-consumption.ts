import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { REPO_ROOT } from "../core/paths";
import type { RuleScanner, Violation } from "../core/types";

const SPEC =
  "R9 — no `var(--rezics-*)` and no hand-written tokens.css; tokens come only from uno-config";

// Match any `--rezics-*` CSS variable reference. That whole namespace is
// retired; the flat
// `--colors-*` / `--radius-*` / `--shadow-*` / `--font-*` / `--duration-*` /
// `--easing-*` surface emitted by `package/ui/src/config/uno-config.ts` is the
// only sanctioned form.
// 匹配任何 `--rezics-*` CSS 变量引用。整个命名空间已废弃；唯一被认可的形式是
// `package/ui/src/config/uno-config.ts` 输出的扁平
// `--colors-*` / `--radius-*` / `--shadow-*` / `--font-*` / `--duration-*` /
// `--easing-*` 变量集。
const REZICS_VAR_PATTERN = /var\(\s*--rezics-[a-zA-Z0-9_-]+/;

// `package/ui/src/config/tokens.css` SHALL NOT exist — the tokens TS source is
// authoritative and uno-config.ts emits the runtime CSS variables.
// `package/ui/src/config/tokens.css` 不应存在——tokens 的 TS 源才是权威，
// 由 uno-config.ts 输出运行时 CSS 变量。
const TOKENS_CSS_PATH = join(REPO_ROOT, "package/ui/src/config/tokens.css");

// SVG-inline / chart-fill exceptions. Each entry SHALL include a comment
// explaining why a UnoCSS shortcut cannot yet replace it. Reviewed quarterly;
// SHALL shrink over time.
// SVG 内联 / 图表填充例外。每个条目都应附带注释说明为何 UnoCSS shortcut
// 暂时无法替代它。每季度审查；条目应随时间减少。
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
