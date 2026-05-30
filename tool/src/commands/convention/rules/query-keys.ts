import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { REPO_ROOT } from "../core/paths";
import type { RuleScanner, Violation } from "../core/types";

const SPEC =
  "R6 — queryKey arrays live only in per-domain .keys.ts factories; no inline `queryKey: [` in app/admin/ui";

const INLINE_PATTERN = /queryKey\s*:\s*\[/g;

function isTarget(absPath: string): boolean {
  const relPath = relative(REPO_ROOT, absPath);
  if (!/^package\/(app|admin|ui)\//.test(relPath)) return false;
  if (!/\.(ts|tsx)$/.test(relPath)) return false;
  if (/\.test\.tsx?$/.test(relPath)) return false;
  return true;
}

export const queryKeysRule: RuleScanner = {
  scan({ tsAndTsxFiles }) {
    const violations: Violation[] = [];

    for (const filePath of tsAndTsxFiles) {
      if (!isTarget(filePath)) continue;

      let content: string;
      try {
        content = readFileSync(filePath, "utf8");
      } catch {
        continue;
      }

      const relPath = relative(REPO_ROOT, filePath);
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (INLINE_PATTERN.test(lines[i]!)) {
          violations.push({
            rule: "R6",
            path: `${relPath}:${i + 1}`,
            message:
              "Inline `queryKey: [` — move this key into a per-domain factory in package/api/src/<domain>/<domain>.keys.ts and consume it via a queryOptions / useQuery wrapper.",
            spec: SPEC,
          });
        }
        INLINE_PATTERN.lastIndex = 0;
      }
    }

    return violations;
  },
};
