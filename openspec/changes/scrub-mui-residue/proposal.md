## Why

The `2026-05-04-deprecate-mui` migration removed every runtime `@mui/*` and `@material/material-color-utilities` dependency from rezics. The migration is archived. What remains is residue: convention rule R8 still scans for `@mui/*` imports that can no longer exist, multiple active OpenSpec specs still describe their behavior in MUI terminology, the `rezics-design` skill still teaches MUI-vs-shadcn decisions, and one custom primitive (`MUILink`) plus its 17 importers still carry MUI in their names. This residue makes the codebase look like a project still mid-migration rather than one that has chosen a single component foundation. The cost of keeping it: AI agents and contributors must continue absorbing MUI vocabulary that has no application; spec readers must mentally separate "what's true now" from "what was true before deprecate-mui"; the convention check spends cycles on a rule that can never fire. With deprecate-mui complete and stable, this is the moment to scrub the residue and present the codebase as a clean, MUI-unaware system.

## What Changes

- **R8 removed from `tool/scripts/check-convention.ts`.** The MUI-import rule and its `package.json`-dependency rule are deleted; the `Rule` union, `SPEC_LINK` map, summary log line, baseline-key filter, and supporting scanners go with it.
- **Active OpenSpec specs scrubbed of MUI references.** Specs that previously documented "MUI does X" alongside the shadcn successor are collapsed to one current state. Specs whose Purpose was a placeholder (`TBD - created by archiving change deprecate-mui`) get rewritten Purposes. **BREAKING for spec readers**: prior obsolete requirements that referenced MUI are removed rather than kept as historical annotations.
- **`rezics-design` skill rewritten.** `mui-vs-shadcn.md` deleted. `component-selection.md` keeps the shadcn-or-custom decision flow but loses the MUI → replacement map. `icons.md` loses its entire MUI → lucide mapping table (the right column of approved icons by category is no longer paired with a left column of MUI names). `SKILL.md`, `tokens.md`, `voice.md`, `patterns.md` rewritten so no rule, table, or example mentions MUI.
- **`MUILink` renamed to `TextLink`.** The primitive (`package/ui/src/primitive/link/MUILink.tsx`) and its stories file are renamed; the symbol export changes from `MUILink` to `TextLink`; the 17 consumer files in `package/app/src/` are updated to import the new name. The implementation does not change.
- **Comment, test, and README scrubs.** Source comments referencing "MUI" in `PasswordField.tsx`, `RezicsMarkdownEditor.tsx`, `tokens/spacing.ts`, `tokens/radius.ts`, `Pagination.tsx`, and `Welcome.stories.tsx` are removed or rephrased. The `EmptyState.test.tsx` smoke test that asserts `@mui/material` is not imported is deleted (R8 made it redundant; with R8 also removed, neither lever exists, but the migration's done so the test serves no purpose). `package/admin/README.md` and `package/app/README.md` lose their "Material-UI 7" stack lines. `CLAUDE.md` and `CONTRIBUTING.md` rewrite their "No-MUI Policy" / "UI Component Policy (no MUI)" sections as positive shadcn-or-custom policy with no MUI naming. `package/app/openspec/changes/book-edit-polish/README.md` one-liner is fixed.
- **Out of scope:** the archived change at `openspec/changes/archive/2026-05-04-deprecate-mui/` is left untouched as the historical record. Lockfile entries for transitively-installed `@mui/*` (none expected, but if any exist) are not policed.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `convention-enforcement`: drop the two R8 requirements (`R8 — No @mui/* imports outside the deprecate-mui change archive` and `R8 SPEC_LINK is registered in the check script`). The convention check no longer enforces an MUI rule.
- `ui-component-foundation`: replace MUI-named prohibitions with a generic third-party-UI-library prohibition; rewrite the Purpose; soften the on-demand-primitive requirement to drop the "removing MUI was impossible without them" framing.
- `icon-system`: rewrite the Purpose; drop the "Canonical mapping table for former MUI icons" requirement (the skill file no longer carries an MUI mapping).
- `design-system-foundation`: drop superseded MUI-theme requirements (`MUI theme exposes light and dark themes`, MUI-related scenarios, MUI-Theme-Provider-prohibition wording).
- `design-system-storybook`: drop the superseded "MUI ThemeProvider in preview" requirement; the surviving requirement is the shadcn/data-theme-attribute one.
- `design-system-adoption`: drop MUI-specific defensibles and the MUI-import-counting scenario.
- `design-system-voice-patterns`: drop the superseded "MUI-first component policy" requirement and the related scenario; drop the `mui-vs-shadcn.md` file reference.
- `query-error-display`: drop the superseded "MUI Alert-based styling" requirement.
- `admin-auth-pages`: drop MUI imports/components/icons references; the surviving requirements use shadcn names.
- `settings-layout`: drop MUI Tabs reference.
- `book-detail-tab-layout`: drop MUI Tabs / "no MUI imports" wording.
- `list-empty-state`: drop the obsolete MUI-primitives composition requirement.
- `dissolve-app-shell`: drop MUI theme factory references.
- `realm-frontend`: drop the MUI-icon line in the manage-icon requirement.
- `post-reply-composer`: drop the `TextField of MUI size="small"` reference.
- `review-remark-ux`: drop the obsolete MUI Rating requirements; surviving requirements use the `RatingInput` primitive.
- `score-input-primitive`: drop the obsolete "Score input renders as MUI Rating" requirement.
- `app-search-feature`, `tag-interaction-component`: drop residual MUI references found in their texts.

## Impact

- **Affected code**: `tool/scripts/check-convention.ts` (R8 removal); `package/ui/src/primitive/link/{MUILink.tsx → TextLink.tsx, MUILink.stories.tsx → TextLink.stories.tsx, index.ts}`; 17 consumer files under `package/app/src/`; `package/ui/src/composite/forms/field/PasswordField.tsx`; `package/ui/src/editor/RezicsMarkdownEditor.tsx`; `package/ui/src/composite/feedback/EmptyState.test.tsx`; `package/ui/src/config/tokens/{spacing.ts,radius.ts}`; `package/ui/src/composite/pagination/Pagination.tsx`; `.storybook/stories/Welcome.stories.tsx`.
- **Affected docs**: `CLAUDE.md`, `CONTRIBUTING.md`, `package/admin/README.md`, `package/app/README.md`, `package/app/openspec/changes/book-edit-polish/README.md`.
- **Affected specs**: ~16 files under `openspec/specs/` (delta files in this change supply the changes).
- **Affected skills**: `.claude/skills/rezics-design/{SKILL.md, component-selection.md, icons.md, tokens.md, voice.md, patterns.md}` (rewrites) and `mui-vs-shadcn.md` (deletion).
- **APIs**: One public symbol rename — `@rezics/ui` consumers that import `MUILink` get `TextLink`. No prop changes; mechanical find-and-replace inside the monorepo. No external consumers exist (the monorepo is the only consumer).
- **Dependencies**: No `package.json` changes. No runtime behavior change.
- **Backward compatibility**: For the symbol rename, no transitional alias is exported — `MUILink` ceases to exist and all in-tree importers update in the same change. There are no pre-`scrub-mui-residue` consumers outside this monorepo, so a deprecation window is unnecessary.
- **Migration needs**: None. Implementation is mechanical: edit, rename, delete.
- **Affected packages**: `package/app`, `package/ui`, `package/admin` (README only), top-level repo files.
