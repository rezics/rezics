import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { REPO_ROOT } from "../core/paths";
import type { RuleScanner, Violation } from "../core/types";

const SPEC =
  "R5 — no raw <a href> outside the SafeLink/Link primitives (rel/target safety + outbound interstitial)";

const ALLOWLIST = new Set([
  "packages/ui/src/link/SafeLink.tsx",
  "packages/ui/src/primitive/link/Link.tsx",
  "packages/ui/src/primitive/link/TextLink.tsx",
]);

const RAW_ANCHOR_PATTERN = /<a\s[^>]*href=/g;

export const safeLinkRule: RuleScanner = {
  scan({ tsxFiles }) {
    const violations: Violation[] = [];

    for (const filePath of tsxFiles) {
      const relPath = relative(REPO_ROOT, filePath);
      if (ALLOWLIST.has(relPath)) continue;

      let content: string;
      try {
        content = readFileSync(filePath, "utf8");
      } catch {
        continue;
      }

      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (RAW_ANCHOR_PATTERN.test(lines[i]!)) {
          violations.push({
            rule: "R5",
            path: `${relPath}:${i + 1}`,
            message:
              "Raw <a href> found — use <SafeLink> from @rezics/ui instead",
            spec: SPEC,
          });
        }
        RAW_ANCHOR_PATTERN.lastIndex = 0;
      }
    }

    return violations;
  },
};
