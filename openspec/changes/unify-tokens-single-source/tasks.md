## 1. Inventory and prep

- [x] 1.1 Snapshot the current `var(--rezics-*)` reference set: `rg --no-heading "var\(--rezics-" -g '*.{css,ts,tsx,js,jsx,mdx}' > openspec/changes/unify-tokens-single-source/codemod-input.txt` (commit alongside this change for reviewability; delete after merge)
- [x] 1.2 Snapshot the current `unocss-preset-shadcn` import set in `package/ui/src/config/`
- [x] 1.3 Read `package/ui/src/config/tokens.css` end-to-end and extract any value that is NOT already represented in `tokens/colors.ts` (e.g. tokens added directly to CSS); add them to the TS source before deletion
- [x] 1.4 Verify all 32 shadcn theme keys have a value mapping in `tokens/colors.ts` (or extend the file to include them — see Decision 3 mapping table in `design.md`)

## 2. Rewrite `tokens/colors.ts` as the single source of truth

- [x] 2.1 Update the `ColorTokens` interface in `package/ui/src/config/tokens/colors.ts` to include all 32 shadcn keys at top-level alongside existing rezics extension groups (`surface`, `brand`, `semantic`, `sentiment`, `border`, `inverse`, `chart`, `sidebar`, plus new top-level `primary`, `background`, `foreground`, `card`, `popover`, `secondary`, `muted`, `accent`, `destructive`, `input`, `ring`)
- [x] 2.2 Populate `lightColors` with values for the new top-level shadcn keys, sourcing from existing rezics roles per the design.md mapping table (do not invent new colors — reuse existing values)
- [x] 2.3 Populate `darkColors` symmetrically
- [x] 2.4 Re-export from `tokens/index.ts` unchanged (no shape change at the index level)
- [x] 2.5 Run `bun run --filter @rezics/ui tsc --noEmit` to verify the TS source compiles

## 3. Rewrite `uno-config.ts`

- [x] 3.1 Remove `import { presetShadcn } from "unocss-preset-shadcn"` and its `presetShadcn(...)` invocation from `presets`
- [x] 3.2 Remove `unocss-preset-shadcn` from `package/ui/package.json` and any other package.json that imported it
- [x] 3.3 Add `import { lightColors, darkColors } from "./tokens/colors"` to `uno-config.ts`
- [x] 3.4 Set `theme.colors = lightColors` (replacing the curated `var(--rezics-sys-color-*)`-string mapping)
- [x] 3.5 Add a `flattenColorVars(obj, parent="colors")` helper that walks the tokens object and produces `[name, value]` pairs (`["--colors-primary", "#f4606c"]`, `["--colors-surface-elevated", "#ffffff"]`, etc.)
- [x] 3.6 Add a `preflights[]` entry with `layer: "theme"` whose `getCSS()` returns `.dark { ... }` containing flattened `darkColors` vars
- [x] 3.7 Add the 4 keyframe rules formerly provided by `unocss-preset-shadcn` (`accordion-down`, `accordion-up`, `collapsible-down`, `collapsible-up`) as inline `rules` entries
- [x] 3.8 Configure `dark: 'class'` so `dark:` variant wraps with `.dark` selector (matches our preflight)
- [x] 3.9 Confirm the existing shortcuts (`state-hover`, `state-focus`, `state-pressed`) still reference valid theme keys; rewire to flat names if any reference `--rezics-*`
- [x] 3.10 Run `bun run --filter @rezics/ui tsc --noEmit`

## 4. Delete `tokens.css` and inline-style residue

- [x] 4.1 Delete `package/ui/src/config/tokens.css`
- [x] 4.2 Find every file that imports `tokens.css` (e.g. `import "./tokens.css"`) and remove the import: `rg "tokens\.css" -g '*.{ts,tsx,js,jsx,css,html}'`
- [x] 4.3 If any remaining `.css` file in the repo declares `--rezics-*` properties, delete those declarations (search with `rg "^\s*--rezics-" -g '*.css'`)

## 5. Codemod monorepo references

- [x] 5.1 Author a one-shot codemod script at `package/ui/scripts/codemod-rezics-to-flat.ts` that:
  - Reads a mapping from old name (`--rezics-sys-color-text-primary`) to new name (`--colors-foreground`) — the mapping mirrors the design.md table
  - Walks `package/{ui,app,admin,editor,folio,storybook}/src/**/*.{ts,tsx,css,mdx}` (configurable)
  - Replaces `var(--rezics-…)` with the flat equivalent
  - Replaces `theme="rezics"` / `data-theme="rezics"` / `data-theme="dark"` attribute writes with class-toggle equivalents (in known toggle locations only — list is small)
  - Prints a summary count
- [x] 5.2 Dry-run the codemod and inspect the diff for false positives
- [x] 5.3 Run the codemod for real
- [x] 5.4 `rg --no-heading "var\(--rezics-" -g '*.{css,ts,tsx,js,jsx,mdx}'` SHALL produce zero matches; manually fix any survivors
- [x] 5.5 Delete the codemod script and the `codemod-input.txt` snapshot from step 1.1 (one-shot, not retained)

## 6. Update theme-toggle / mode-switching code

- [x] 6.1 Find theme toggle implementation: `rg "data-theme|setAttribute.*theme" -g '*.{ts,tsx}' package/app package/admin`
- [x] 6.2 Replace `setAttribute('data-theme', mode)` with `classList.toggle('dark', mode === 'dark')` on `<html>`
- [x] 6.3 Update SSR / initial-render injection (if any) to set `class="dark"` on `<html>` based on stored preference
- [x] 6.4 Verify `package/app` boots and the toggle still works visually in dev (`bun run app:dev`, manually toggle dark mode)

## 7. Update convention check (R9)

- [x] 7.1 Open `bin/check-convention.ts` (or the file that defines R9)
- [x] 7.2 Replace the deprecated-name list and `--rezics-*` patterns with: ban any `var(--rezics-` reference anywhere in source files
- [x] 7.3 Keep the curated short-name expectation (`text-primary`, `bg-surface-elevated`, etc.)
- [x] 7.4 Add a new check: `tokens.css` SHALL NOT exist at `package/ui/src/config/tokens.css`
- [x] 7.5 Run `bun run check:convention` — expect zero violations
- [x] 7.6 Update `package/ui/src/check-tokens.ts` (the script that validates token names against a known list) to read from `tokens/colors.ts` shape rather than a hardcoded list of `--rezics-sys-color-*` names

## 8. Update Storybook and docs

- [x] 8.1 Find Storybook MDX files referencing `--rezics-*` token names: `rg "--rezics-" package/storybook -g '*.{mdx,ts,tsx}'`
- [x] 8.2 Update prose and inline color swatches to display the flat names (`--colors-primary` instead of `--rezics-sys-color-primary`)
- [x] 8.3 Update `package/ui/src/config/README.md` if it documents the namespace (point at the flat names + `tokens/colors.ts` as source)
- [x] 8.4 Update root `CLAUDE.md`'s "Token Consumption Convention" section: replace `--rezics-…-color-…` references with the flat-name namespace; refresh the R9 description

## 9. Validation

- [x] 9.1 `bun run --filter @rezics/ui tsc --noEmit` — clean (only pre-existing Storybook 10 story-args type errors remain; none from this migration)
- [x] 9.2 `bun run --filter @rezics/app tsc --noEmit` — clean (only pre-existing Storybook story-args + unrelated route-type errors)
- [x] 9.3 `bun run --filter @rezics/admin tsc --noEmit` — clean (only unrelated TanStack Router route-type errors)
- [x] 9.4 `bun run check:convention` — clean (R9=0; baseline R1=5/R5=1 unchanged)
- [x] 9.5 `bun run knip` — no `unocss-preset-shadcn` or `tokens.css` references remain
- [x] 9.6 `bun run dev` (in `package/app`) — vite serves index.html (HTTP 200), no stale `data-theme=…` attribute, served `/__uno.css` exposes `--colors-*` custom properties and a `.dark { … }` override block
- [x] 9.7 Dark mode override applies via `.dark` selector — verified in served CSS (single `.dark { … }` block emitted by the preflight)
- [x] 9.8 `bun test` in `package/ui` — 23 pass; 2 pre-existing failures in `TrustedEmailField.test.tsx` (last touched before this branch) are unrelated

## 10. Cleanup

- [x] 10.1 Verify there are no comments referencing the old namespace anywhere in `package/ui/src/config/`
- [x] 10.2 Verify `unocss-preset-shadcn` is removed from `bun.lock` (re-ran `bun install` after dep removal)
- [ ] 10.3 Open the PR; ensure description references this change proposal and `design.md` for context
