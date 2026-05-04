## Context

The `2026-05-04-deprecate-mui` change ran a single-shot migration: it replaced every MUI primitive with shadcn or rezics-owned equivalents, deleted `@mui/*` and `@material/material-color-utilities` from every `package.json`, introduced convention rule R8 to fence the result, and shipped three custom primitives (`RatingInput`, `EmptyState`, `Spinner`) where shadcn lacked coverage. That change is archived. The codebase is now MUI-free at runtime and at the dependency level.

The residue this change scrubs is everything else: text mentions of MUI in active OpenSpec specs, the entire `mui-vs-shadcn.md` skill file, the MUI → lucide icon mapping table in `icons.md`, the `MUILink` symbol name in `package/ui` and 17 importers, R8 itself in `tool/scripts/check-convention.ts`, comment lines that explain a current decision in terms of "what MUI used to do," and the `EmptyState.test.tsx` smoke test that asserts `@mui/material` is not imported. None of this residue affects program behavior. All of it costs reader attention.

The constraint shaping this design: the historical record must remain accessible. The OpenSpec archive (`openspec/changes/archive/2026-05-04-deprecate-mui/`) preserves the full migration story — proposal, design, tasks, deltas, inventory. Anyone needing to understand "why does this look the way it does" can read the archive. Therefore the active codebase does not need a parallel "this used to be MUI" annotation everywhere.

The migration also superseded older spec requirements with shadcn-based versions in the same files (e.g., `query-error-display/spec.md` has a `MUI Alert-based styling` requirement and a later `shadcn Alert family` requirement). OpenSpec specs are current-state documents, not change logs — but the deprecate-mui archive operation kept both versions in place. This change resolves that tension by deleting the obsolete MUI versions and leaving the shadcn versions standalone.

## Goals / Non-Goals

**Goals:**
- After this change, `grep -ril "mui\|material-ui" /home/edge/projects/rezics/rezics --include="*.md" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.js"` (excluding `node_modules`, `dist`, `storybook-static`, `bun.lock`, and `openspec/changes/archive/`) returns no results.
- The convention check no longer references MUI in any rule, scanner, comment, or summary line.
- The `rezics-design` skill teaches component selection without naming MUI as the alternative being rejected.
- The `MUILink` symbol becomes `TextLink` everywhere it appears as identifier, file name, story title, or import specifier.
- The change is wrappable as a single OpenSpec proposal with mechanical task execution (no judgment calls during apply phase).

**Non-Goals:**
- Re-evaluating the shadcn-or-custom policy. The policy stands; only the wording in support of it changes.
- Touching the archived `2026-05-04-deprecate-mui` change. It is the historical record.
- Auditing `bun.lock` or `node_modules/` for transitively-installed `@mui/*`. The runtime contract is set by `package.json` files, which the prior change already cleared.
- Renaming or restructuring shadcn primitives, the three custom primitives shipped with deprecate-mui, or any unrelated UI component.
- Introducing a new convention rule. R8 is removed; nothing replaces it. The shadcn-or-custom policy remains documented in `ui-component-foundation` and is enforced by code review only.
- Changing component behavior. `TextLink.tsx` is byte-for-byte the same as `MUILink.tsx` apart from the renamed export. Comment scrubs do not modify surrounding logic.

## Decisions

### Decision 1: Remove R8 instead of generalizing it to "any third-party UI library"

**Choice:** Delete R8 entirely. Do not replace it with a `@chakra-ui/*` / `@mantine/*` / `antd` scanner.

**Rationale:** R8 existed to fence the deprecate-mui result while the migration was raw. With deprecate-mui archived and stable, the rule's job is done — it scans for an import that cannot occur because the package is not installed. A generalized "no third-party UI library" rule would catch a class of mistakes that no current contributor is making and that the shadcn-or-custom policy in `ui-component-foundation` already addresses at the spec level. Code review is the right enforcement layer for "did this PR add a new third-party UI library"; a regex scanner is the wrong layer because the next library is unpredictable. We can re-introduce a specific rule if a specific contamination ever appears.

**Alternatives considered:**
- *Keep R8 as a no-op insurance policy*: cheap to keep, but it teaches every reader of the convention check "this codebase is mid-MUI-migration." The point of this change is to retire that framing.
- *Generalize to `BANNED_UI_LIBRARIES = ["@mui/", "@chakra-ui/", "@mantine/", "antd"]`*: speculative coverage. None of those packages have ever been in this repo. Adding scanners for hypothetical future contamination is exactly the kind of preemptive design CLAUDE.md tells us to avoid.

### Decision 2: Delete MUI-named obsolete spec requirements rather than annotate them as superseded

**Choice:** In specs that contain both an obsolete MUI-based requirement and a newer shadcn-based one, delete the MUI version. Do not retain it with a `## Superseded` annotation.

**Rationale:** OpenSpec specs are current-state contracts. Each requirement should describe behavior that is currently expected. Retaining superseded requirements blurs the contract and forces every reader to determine "is this still in force?" The archived deprecate-mui change is the canonical historical record; specs can be standalone current-state.

**Alternatives considered:**
- *Annotate as `### Requirement (SUPERSEDED): MUI Alert-based styling`*: keeps the lineage visible inline. Considered and rejected — it adds noise to specs that are already long, and the same information is one git-log away. The archive folder is the proper place for the lineage.
- *Convert to a "## Historical Notes" appendix in each spec*: same problem as the inline annotation, just relocated. The active spec gets longer; readers still need to skip past it.

### Decision 3: Delete `EmptyState.test.tsx` MUI-import smoke test rather than rewrite it

**Choice:** Remove the test entirely. Do not rewrite it as "does not import any MUI-like third-party UI library."

**Rationale:** The smoke test was a belt-and-braces check during deprecate-mui to catch a possible accidental re-import. With R8 also being removed and the package not installed, the test cannot meaningfully fail. Rewriting it as a generic "no third-party UI library" check is speculative coverage (same logic as Decision 1). The test's other assertions (component render output, prop wiring) remain.

**Alternatives considered:**
- *Keep it as a regression sentinel*: low cost, but it's a test about a former state, not the current behavior. Codebase tests should test current behavior. The git log preserves the sentinel's history.

### Decision 4: Rename `MUILink` to `TextLink` (not `StyledLink`, `RezicsLink`, or merge into `Link`)

**Choice:** `TextLink`.

**Rationale:** The primitive is a TanStack-Router `Link` styled to render as inline body text — color, underline, and a small set of typography variants (the `body1`/`body2`/`subtitle1` legacy props). "TextLink" describes the function: a link that renders inline within text content, distinct from the unstyled `Link` re-export which is for navigation in arbitrary UI chrome. The legacy `variant` and `color` props are kept so the rename can be mechanical; their MUI lineage in the typography names (`body1`, `subtitle1`) becomes a slightly out-of-place historical detail but is not load-bearing for the rename.

**Alternatives considered:**
- *`StyledLink`*: too generic; doesn't say *what kind* of styling.
- *`RezicsLink`*: reads as "the rezics version of Link" which describes provenance, not function. Other rezics-owned primitives don't use the `Rezics*` prefix, so this would be inconsistent.
- *Merge into `Link.tsx` as a named export alongside the bare TanStack re-export*: would conflate two different functions (unstyled vs. styled link) under one filename. The current two-file split is clearer.
- *Keep `MUILink` as a deprecated alias*: defeats the purpose of the change. There are no external consumers.

### Decision 5: Delete the `icons.md` MUI → lucide mapping table (per user direction)

**Choice:** Drop the mapping table entirely. Do not reformat to a category-only "approved icons" list.

**Rationale:** Per user direction. The argument: a category-only list is something the AI can derive from `lucide-react`'s own documentation, and the rezics-specific picks (e.g., `Description` → `FileText` because lucide has no `Description`) only matter when migrating from MUI. With migration done, the table no longer pays its way.

**Alternatives considered:**
- *Reformat to "by category, here are the icons we use"*: rejected by user.
- *Move to the archive*: not necessary — the table already lives in `openspec/changes/archive/2026-05-04-deprecate-mui/` (in design.md or spec.md form) as part of the migration record.

### Decision 6: Wrap the work as one OpenSpec change rather than several

**Choice:** Single change `scrub-mui-residue` covering all 50+ files.

**Rationale:** The work is mechanical and topically coherent — every edit removes one specific concept (MUI naming) from one specific surface. Splitting into "specs change" / "skill change" / "code change" / "docs change" would create artificial boundaries and lose the property that all four happen atomically. After this change lands, "git log shows when MUI vocabulary disappeared from the codebase" is a single hash. Per CLAUDE.md, OpenSpec is for non-trivial changes; this qualifies as one non-trivial change, not four.

**Alternatives considered:**
- *Three changes*: code-rename / spec-scrub / skill-rewrite. Considered for safety (smaller blast radius per change). Rejected because the user explicitly framed the goal as a single sweep ("after this change") and because no in-flight contributor work is expected to land between sub-changes — the monorepo has one author.

## Risks / Trade-offs

- **[Risk] Delete-not-annotate spec scrub loses inline lineage.** A future reader of `query-error-display/spec.md` will not see "this used to require MUI Alert" without navigating to the archive.
  → **Mitigation:** The archive at `openspec/changes/archive/2026-05-04-deprecate-mui/specs/` retains the prior spec content. The `proposal.md` and `tasks.md` of this scrub change explicitly enumerate which obsolete requirements were deleted, so `git log openspec/specs/query-error-display/spec.md` plus the deprecate-mui archive together reconstruct the full history.

- **[Risk] `MUILink` rename touches 17 importers; one missed file = type error.**
  → **Mitigation:** Rename via mechanical find-and-replace on the symbol `MUILink` and the import path `@rezics/ui/primitive/link/MUILink.tsx`. Run `bun run tsc --noEmit` per affected package after the rename. If any path was constructed dynamically (string concat) the type check won't catch it — the inventory step in tasks.md confirms there are no such cases.

- **[Risk] `MUILink.tsx` carries legacy MUI-Typography variant prop names (`body1`, `body2`, `subtitle1`, `subtitle2`, `caption`) that don't get renamed.**
  → **Mitigation:** Accepted as-is. The variant API is an internal contract used by the 17 callers; renaming the variant strings would balloon the change beyond the agreed scope. This residual artifact is documented here so a future cleanup can target it specifically.

- **[Risk] R8 removal could mask a future regression where someone re-introduces an `@mui/*` import.**
  → **Mitigation:** PR review is the enforcement layer. The shadcn-or-custom requirement in `ui-component-foundation` remains in force. If anyone tries to add `@mui/*` to a `package.json`, the diff is conspicuous; if they try to add an import, type-checking will fail (the package isn't installed). Both signals are stronger than a regex check.

- **[Risk] The icon mapping table deletion may strand any in-tree code that still uses an MUI icon name.**
  → **Mitigation:** The deprecate-mui archive confirms zero `@mui/icons-material` imports remain. The mapping was reference material for migration, not for current code.

- **[Trade-off] No deprecation period for the `MUILink` symbol rename.**
  → Deliberate. The monorepo is the only consumer; no external code imports from `@rezics/ui/primitive/link/MUILink`. A deprecation alias would be ceremony for an audience that doesn't exist.

- **[Trade-off] Skill files lose ~250 lines (the icon mapping table) that future contributors might find useful as a reference.**
  → Accepted per Decision 5. The information lives in the archive and in lucide's own docs.

## Migration Plan

This is a non-runtime change; there is no data migration, deployment ordering, or rollback complexity in the conventional sense.

**Apply order (matches `tasks.md`):**

1. Convention check (R8 removal) — atomic edit to `tool/scripts/check-convention.ts`.
2. Source code scrubs (rename `MUILink` → `TextLink`, comment edits, test deletion, token comment cleanup) — touches `package/ui`, `package/app`.
3. Active OpenSpec spec edits — delete obsolete MUI-named requirements; rewrite Purposes for `ui-component-foundation` and `icon-system`.
4. Skill file rewrites and deletion — `mui-vs-shadcn.md` deletion, `component-selection.md` / `icons.md` / `SKILL.md` / `tokens.md` / `voice.md` / `patterns.md` rewrites.
5. Top-level docs — `CLAUDE.md`, `CONTRIBUTING.md`, package READMEs, `book-edit-polish/README.md`.

**Verification at each step:**
- After step 1: `bun run check:convention` runs and exits without R8 in its output.
- After step 2: per-package `bun run tsc --noEmit` passes for `package/ui` and `package/app`. The grep confirming "no MUI mentions in source files" returns clean.
- After step 3: `bun openspec validate scrub-mui-residue --strict` passes.
- After step 5: full-tree grep `grep -ril "mui\|material-ui" --include="*.md" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.js"` excluding `node_modules`, `dist`, `storybook-static`, `bun.lock`, and `openspec/changes/archive/` returns zero matches.

**Rollback:** revert the merge commit. The change is contained to one branch with no cross-package contracts being broken (the symbol rename is mechanical and atomic within the rollback unit). No data, no migrations, no external integrations are touched.

## Open Questions

- **Should `package/ui/src/config/tokens/spacing.ts` retain `SPACING_BASE_PX = 8`?** The constant existed because MUI's `theme.spacing(N) = N × 8px` consumed it. With MUI gone, no consumer reads it. The task list verifies usage during apply; if zero references, the constant is deleted. If any reference exists, it's kept and the surrounding MUI-explanatory comment is rewritten to describe its current purpose.
- **Should the `body1`/`body2`/`subtitle1`/`subtitle2`/`caption` variant prop names in `TextLink.tsx` (formerly `MUILink.tsx`) be renamed to MUI-free equivalents (`base`/`small`/`subtitle`/`subtitle-small`/`caption`)?** Decided no for this change — the Risks section accepts it as residual. If a future change targets the variant API specifically, that change can rename. Out of scope here.
