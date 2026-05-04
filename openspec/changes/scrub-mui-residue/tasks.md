## 1. Convention check (R8 removal)

- [x] 1.1 Remove R8 implementation from `tool/scripts/check-convention.ts`: delete `R8_IMPORT_PATTERN`, `R8_FORBIDDEN_PACKAGE_PATTERN`, `scanMuiSourceImports`, `scanMuiPackageJson`, the `Rule` union member `"R8"`, the `SPEC_LINK.R8` entry, the R8 line in the rule-summary preamble, the R8 line in the summary log, and the baseline-key filter that strips R8 keys.
- [x] 1.2 Run `bun run check:convention` from the repository root and confirm the run passes with status 0 and no R8 references in output.
- [x] 1.3 Search the repo for residual `R8` symbols (`rg "\\bR8\\b" tool/scripts/`) and confirm zero matches outside the change archive.

## 2. MUILink → TextLink rename

- [x] 2.1 Rename `package/ui/src/primitive/link/MUILink.tsx` to `package/ui/src/primitive/link/TextLink.tsx`. Inside the file, rename the export from `MUILink` to `TextLink` (e.g., `export const TextLink = createLink(RezicsAnchor)`). The implementation, prop surface, and `RezicsAnchor` internals do not change.
- [x] 2.2 Rename `package/ui/src/primitive/link/MUILink.stories.tsx` to `package/ui/src/primitive/link/TextLink.stories.tsx` and update its imports, default-export `title`, and story names to use `TextLink`.
- [x] 2.3 Update `package/ui/src/primitive/link/index.ts` to re-export from `./TextLink` instead of `./MUILink`.
- [x] 2.4 Update the 17 in-tree consumers under `package/app/src/` to import `TextLink` instead of `MUILink` (replace both the import name and JSX usages — `<MUILink>` → `<TextLink>`). The consumer files are: `NavigationList.tsx`, `TagCards.tsx`, `BookEditInfoSection.tsx`, `UnitPage.tsx`, `PostTreeSection.tsx`, `ExcerptDetailSection.tsx`, `RemarkDetailSection.tsx`, `NoticeBoard.tsx`, `RemarkCard.tsx`, `ReviewDetailSection.tsx`, `TagByUnitPage.tsx`, `ReviewDetail.tsx`, `RemarkDetail.tsx`, `LoginPage.tsx`, `AnnouncementBar.tsx`, `TagWrapper.tsx`, `TestPage03.tsx`. Use `rg -l "MUILink" package/app/src/` to verify the file list before editing.
- [x] 2.5 Confirm zero remaining matches: `rg "MUILink" package/` SHALL return zero hits. `rg "from .*MUILink" package/` SHALL return zero hits.
- [x] 2.6 Type-check `@rezics/ui` and `@rezics/app` (`bun -F @rezics/ui exec tsc --noEmit` and `bun -F @rezics/app exec tsc --noEmit`) and confirm no errors related to the rename.
- [x] 2.7 Run the `@rezics/ui` Storybook build (`bun -F @rezics/ui run build-storybook`) and confirm the `TextLink` story registers and renders.

## 3. Source comment scrubs

- [x] 3.1 In `package/ui/src/composite/forms/field/PasswordField.tsx`, remove or rephrase any source comment mentioning "MUI" so the file's vocabulary is shadcn/rezics-only.
- [x] 3.2 In `package/ui/src/editor/RezicsMarkdownEditor.tsx`, remove or rephrase any "MUI" comment.
- [x] 3.3 In `package/ui/src/config/tokens/spacing.ts` and `package/ui/src/config/tokens/radius.ts`, remove the comments that frame the token scale relative to MUI's spacing/radius defaults.
- [x] 3.4 In `package/ui/src/composite/pagination/Pagination.tsx`, remove or rephrase any "MUI" comment.
- [x] 3.5 In `.storybook/stories/Welcome.stories.tsx` (root `.storybook` or per-package — search by filename), remove or rephrase any "MUI" comment.
- [x] 3.6 Verify scrub: `rg "MUI" package/ui/src/composite/forms/field/PasswordField.tsx package/ui/src/editor/RezicsMarkdownEditor.tsx package/ui/src/config/tokens/spacing.ts package/ui/src/config/tokens/radius.ts package/ui/src/composite/pagination/Pagination.tsx` SHALL return zero hits.

## 4. Test removals

- [x] 4.1 Delete `package/ui/src/composite/feedback/EmptyState.test.tsx` if its only assertion is the `@mui/material` non-import smoke test. If the file contains additional assertions, remove only the MUI-related test case and any imports used solely by it.
- [x] 4.2 Run `bun -F @rezics/ui test` and confirm the test suite still passes.

## 5. README and CLAUDE.md scrubs

- [x] 5.1 In `CLAUDE.md`, rewrite the "## No-MUI Policy" section as a positive "## UI Component Policy" (or equivalently named) section that states the shadcn-or-custom rule, references `openspec/specs/ui-component-foundation/spec.md` as authoritative, and contains no "MUI" or "@mui" tokens. Adjust nearby cross-references that point to R8 to point to the spec instead.
- [x] 5.2 In `CONTRIBUTING.md`, rewrite the "UI Component Policy (no MUI)" section symmetrically — positive shadcn-or-custom framing, no MUI naming, point to the same spec.
- [x] 5.3 In `package/admin/README.md` and `package/app/README.md`, drop the "Material-UI 7" line from the stack list. Keep all non-MUI bullets intact.
- [x] 5.4 In `package/app/openspec/changes/book-edit-polish/README.md`, fix the one-liner that mentions MUI so it reflects the current shadcn-based implementation.
- [x] 5.5 Verify: `rg "MUI|@mui|Material-UI" CLAUDE.md CONTRIBUTING.md package/admin/README.md package/app/README.md package/app/openspec/changes/book-edit-polish/README.md` SHALL return zero hits.

## 6. rezics-design skill rewrite

- [x] 6.1 Delete `.claude/skills/rezics-design/mui-vs-shadcn.md`.
- [x] 6.2 Rewrite `.claude/skills/rezics-design/component-selection.md` so the selection table covers modal / form / button / table / empty-state / navigation / rating-input rows with `shadcn` / `custom` recommendations only — no MUI column, no MUI examples.
- [x] 6.3 Rewrite `.claude/skills/rezics-design/icons.md` to delete the entire MUI → lucide / tabler mapping table. Keep the brand-icon table and the non-brand category lists. The file SHALL contain zero "MUI" tokens.
- [x] 6.4 Rewrite `.claude/skills/rezics-design/SKILL.md` so the front-matter, the file index, the Hard-Never list, and any in-line examples mention no MUI. Update the file index to drop `mui-vs-shadcn.md` and to list `component-selection.md`.
- [x] 6.5 Rewrite `.claude/skills/rezics-design/tokens.md` to remove any "MUI theme" framing.
- [x] 6.6 Rewrite `.claude/skills/rezics-design/voice.md` to remove any MUI examples or comparisons.
- [x] 6.7 Rewrite `.claude/skills/rezics-design/patterns.md` to remove MUI examples (e.g., `MUI Material Icons` line, "no MUI ThemeProvider" parenthetical) and to align the icon section with the shadcn-or-custom + lucide-default policy.
- [x] 6.8 Verify: `rg -i "mui|@mui|material-ui" .claude/skills/rezics-design/` SHALL return zero hits.

## 7. Active OpenSpec specs scrub

- [x] 7.1 For each spec listed in this change's `specs/**/spec.md`, apply the delta to the corresponding `openspec/specs/<capability>/spec.md` file: delete the obsolete duplicate requirement (the older MUI-flavored copy when both versions exist), copy the MODIFIED requirement block in as the single current statement, and update the file's `## Purpose` if it says `TBD - created by archiving change deprecate-mui`.
- [x] 7.2 Specifically rewrite the Purpose for `openspec/specs/ui-component-foundation/spec.md`, `openspec/specs/icon-system/spec.md`, and any other spec whose Purpose is still the deprecate-mui placeholder.
- [x] 7.3 Verify: `rg -i "mui|@mui|material-ui" openspec/specs/` SHALL return zero hits, except inside `openspec/changes/archive/` (which is preserved).

## 8. Final verification

- [x] 8.1 `bun run check:convention` passes with status 0 and contains no R8 references.
- [x] 8.2 `rg "MUI|@mui|Material-UI" --glob '!openspec/changes/archive/**' --glob '!openspec/changes/scrub-mui-residue/**' --glob '!bun.lock' --glob '!.git/**'` returns zero hits.
- [x] 8.3 `bun -F @rezics/ui exec tsc --noEmit`, `bun -F @rezics/app exec tsc --noEmit`, `bun -F @rezics/admin exec tsc --noEmit` all pass.
- [x] 8.4 `bun -F @rezics/ui run build-storybook` succeeds and the `TextLink` story is present in `storybook-static/index.json`.
- [x] 8.5 `openspec validate scrub-mui-residue --strict` (if available) reports no errors.
