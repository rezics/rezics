import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { REPO_ROOT } from "../core/paths";
import type { RuleScanner, Violation } from "../core/types";

const SPEC =
  "R13 — core @rezics/ui must not import host runtime deps (react-router, @rezics/api|server|app|admin)";

const FORBIDDEN_IMPORT_PATTERN =
  /from\s+["'](@tanstack\/react-router|@rezics\/api(?:\/[^"']*)?|@rezics\/server(?:\/[^"']*)?|@rezics\/app(?:\/[^"']*)?|@rezics\/admin(?:\/[^"']*)?)["']|import\s*\(\s*["'](@tanstack\/react-router|@rezics\/api(?:\/[^"']*)?|@rezics\/server(?:\/[^"']*)?|@rezics\/app(?:\/[^"']*)?|@rezics\/admin(?:\/[^"']*)?)["']\s*\)/g;

function isAllowed(relPath: string): boolean {
  return (
    /\.stories\.tsx?$/.test(relPath) ||
    /\.test\.tsx?$/.test(relPath) ||
    relPath.startsWith("packages/ui/src/mocks/")
  );
}

export const uiAutonomyRule: RuleScanner = {
  scan({ tsAndTsxFiles }) {
    const violations: Violation[] = [];

    for (const filePath of tsAndTsxFiles) {
      const relPath = relative(REPO_ROOT, filePath);
      if (!relPath.startsWith("packages/ui/src/")) continue;
      if (isAllowed(relPath)) continue;

      let content: string;
      try {
        content = readFileSync(filePath, "utf8");
      } catch {
        continue;
      }

      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (FORBIDDEN_IMPORT_PATTERN.test(lines[i]!)) {
          violations.push({
            rule: "R13",
            path: `${relPath}:${i + 1}`,
            message:
              "Core @rezics/ui source imports a host runtime dependency — inject the capability or move the integration to an app/admin wrapper",
            spec: SPEC,
          });
        }
        FORBIDDEN_IMPORT_PATTERN.lastIndex = 0;
      }
    }

    try {
      const content = readFileSync(
        join(REPO_ROOT, "packages/ui/src/shadcn/index.ts"),
        "utf8",
      );
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (/from\s+["']\.\/sections["']/.test(lines[i]!)) {
          violations.push({
            rule: "R13",
            path: `packages/ui/src/shadcn/index.ts:${i + 1}`,
            message:
              "@rezics/ui/shadcn must not re-export demo/dashboard sections from the primitive barrel",
            spec: SPEC,
          });
        }
      }
    } catch {
      // Missing barrel in partial worktrees: ignore.
      // 部分工作树中缺失 barrel：忽略。
    }

    return violations;
  },
};
