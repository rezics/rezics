import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { REPO_ROOT } from "../core/paths";
import type { RuleScanner, Violation } from "../core/types";

const SPEC = "openspec/specs/api-route-convention/spec.md";

const ROUTE_PREFIX_ALLOWLIST = new Set([
  "stats",
  "meili",
  "well-known",
  "jwt-services",
  "internal",
  "dispatch",
  "echokv",
  "upload",
  "collect",
  "token",
  "session",
  "dm",
  "score",
  "attribution",
  "link",
  "reaction",
  "zone",
  "realm",
  "shelf",
  "tag",
  "post",
  "book",
  "chapter",
  "feedback",
  "unit",
  "user",
  "brief",
  "list",
  "batch",
  "search",
  "me",
  "admin",
]);

const ELYSIA_PREFIX_PATTERN =
  /new\s+Elysia\s*\(\s*\{[^}]*prefix\s*:\s*["']([^"']+)["']/g;
const ROOT_HANDLER_PATTERN = /\.(get|post)\s*\(\s*["']\/["']\s*,/g;
const ELYSIA_VERB_PATTERN =
  /\.(get|post|put|patch|delete|options|use|onError|derive|decorate|state|resolve|guard|group)\s*\(/g;

function isPluralResource(segment: string): boolean {
  if (ROUTE_PREFIX_ALLOWLIST.has(segment)) return false;
  if (segment.endsWith("ies")) return true;
  if (segment.endsWith("ses")) return true;
  if (segment.endsWith("es") && segment.length > 3) return true;
  if (segment.endsWith("s") && !segment.endsWith("ss") && segment.length > 2)
    return true;
  return false;
}

function isCollectionHandler(handlerSource: string): boolean {
  return (
    /items\s*:/.test(handlerSource) ||
    /ListResponse/.test(handlerSource) ||
    /Array<|: [A-Z]\w*\[\]/.test(handlerSource)
  );
}

export const routePrefixRule: RuleScanner = {
  scan({ apiFiles }) {
    const violations: Violation[] = [];

    for (const filePath of apiFiles) {
      let content: string;
      try {
        content = readFileSync(filePath, "utf8");
      } catch {
        continue;
      }
      const relPath = relative(REPO_ROOT, filePath);

      for (const prefixMatch of content.matchAll(ELYSIA_PREFIX_PATTERN)) {
        const prefix = prefixMatch[1]!;
        const segments = prefix.split("/").filter(Boolean);
        for (const segment of segments) {
          if (isPluralResource(segment)) {
            violations.push({
              rule: "R1",
              path: `${relPath}  prefix="${prefix}"`,
              message: `Elysia prefix contains plural segment "${segment}" — use singular form`,
              spec: SPEC,
            });
            break;
          }
        }
      }

      for (const handlerMatch of content.matchAll(ROOT_HANDLER_PATTERN)) {
        const matchIndex = handlerMatch.index;
        const preceding = content.slice(
          Math.max(0, matchIndex - 120),
          matchIndex,
        );
        if (preceding.includes("@convention:root-list-ok")) continue;

        const after = content.slice(matchIndex);
        ELYSIA_VERB_PATTERN.lastIndex = 1;
        const nextVerb = ELYSIA_VERB_PATTERN.exec(after);
        const end = Math.min(after.length, nextVerb ? nextVerb.index : 2000);
        const handlerSource = after.slice(0, end);

        if (!isCollectionHandler(handlerSource)) continue;

        violations.push({
          rule: "R2",
          path: relPath,
          message: `${handlerMatch[1]!.toUpperCase()} "/" likely returns a collection — move to "/list" or annotate with // @convention:root-list-ok`,
          spec: SPEC,
        });
      }
    }

    return violations;
  },
};
