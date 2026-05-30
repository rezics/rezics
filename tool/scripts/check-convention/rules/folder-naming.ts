import { basename, relative } from "node:path";
import { REPO_ROOT, isExemptPackage, isExemptPath } from "../core/paths";
import type { RuleScanner, Violation } from "../core/types";

const SPEC =
  "R3/R4 — domain/feature folders are singular; container folders are plural from the allowlist below";

const PLURAL_CONTAINER_ALLOWLIST = new Set([
  "hooks",
  "utils",
  "components",
  "pages",
  "sections",
  "states",
  "models",
  "types",
  "routes",
  "handlers",
  "providers",
  "plugins",
  "styles",
  "helpers",
  "constants",
  "fixtures",
  "mocks",
  "layouts",
  "assets",
  "tokens",
  "docs",
  "templates",
  "parts",
  "forms",
  "kinds",
  "presets",
  "stories",
  "decorators",
  "corpus",
  "labels",
  "messages",
]);

// Singular folder names permitted even when their plural form sits on
// PLURAL_CONTAINER_ALLOWLIST, or compounds whose head noun is genuinely
// singular but ends in `s` (e.g. "status", "progress-status").
const SINGULAR_DOMAIN_EXCEPTIONS = new Set(["token", "progress-status"]);

function isLikelyPlural(name: string): boolean {
  if (name.endsWith("ies")) return true;
  if (name.endsWith("ses")) return true;
  if (name.endsWith("es") && name.length > 3) return true;
  if (name.endsWith("s") && !name.endsWith("ss") && name.length > 2)
    return true;
  return false;
}

function findAllowlistedPluralForm(singular: string): string | null {
  for (const plural of PLURAL_CONTAINER_ALLOWLIST) {
    if (plural === `${singular}s`) return plural;
    if (plural === `${singular}es` && /(s|x|z|ch|sh)$/.test(singular))
      return plural;
    if (plural.endsWith("ies") && `${plural.slice(0, -3)}y` === singular)
      return plural;
  }
  return null;
}

export const folderNamingRule: RuleScanner = {
  scan({ folderPaths }) {
    const violations: Violation[] = [];

    for (const dirPath of folderPaths) {
      if (isExemptPath(dirPath)) continue;
      if (isExemptPackage(dirPath)) continue;
      const relPath = relative(REPO_ROOT, dirPath);
      if (!/^package\/[^/]+\/(src|docs|prisma\/seed)/.test(relPath)) continue;
      if (/^package\/[^/]+\/(src|docs)$/.test(relPath)) continue;

      const name = basename(dirPath);
      if (PLURAL_CONTAINER_ALLOWLIST.has(name)) continue;
      if (SINGULAR_DOMAIN_EXCEPTIONS.has(name)) continue;

      if (isLikelyPlural(name)) {
        violations.push({
          rule: "R4",
          path: relPath,
          message: `Plural folder "${name}" is not on the container allowlist — rename to singular or propose a spec amendment`,
          spec: SPEC,
        });
        continue;
      }

      const expectedPlural = findAllowlistedPluralForm(name);
      if (expectedPlural) {
        violations.push({
          rule: "R3",
          path: relPath,
          message: `Singular folder "${name}" matches container allowlist entry "${expectedPlural}" — rename to "${expectedPlural}"`,
          spec: SPEC,
        });
      }
    }

    return violations;
  },
};
