## 1. New primitive scaffolding (`@rezics/ui`)

- [ ] 1.1 Create directory `package/ui/src/primitive/typography/collapsible/`.
- [ ] 1.2 Add `Collapsible.tsx` with the public React component and its TypeScript prop types (`children`, `maxLines`, `fade?`, `alignToggle?`, `showMoreLabel?`, `showLessLabel?`, `expanded?`, `onExpandedChange?`, `className?`, `sx?`).
- [ ] 1.3 Implement collapsed-state CSS via inline style / class: `display: -webkit-box`, `-webkit-line-clamp: var(--max-lines)`, `line-clamp: var(--max-lines)`, `-webkit-box-orient: vertical`, `overflow: hidden`.
- [ ] 1.4 Implement the grid-row animation wrapper (`grid-template-rows: 0fr` collapsed / `1fr` expanded, 220 ms ease, `@media (prefers-reduced-motion: reduce)` disables transition).
- [ ] 1.5 Implement overflow detection with `ResizeObserver` on the content ref (guarded `setState` to avoid re-entry); initial state assumes overflow to match SSR render.
- [ ] 1.6 Implement controlled / uncontrolled state behavior: when `expanded` prop is defined, use it; otherwise `useState(false)`. Call `onExpandedChange` on toggle activation.
- [ ] 1.7 Implement the toggle as MUI `<Button variant="text" size="small" disableRipple>` with `sx={{ px: 0, minWidth: 0, textTransform: 'none', fontWeight: 500 }}`, `aria-expanded`, `aria-controls`. Render below content; hide via `display: none` when no overflow (not by unmounting).
- [ ] 1.8 Implement optional `fade` via `mask-image` + `-webkit-mask-image` on the collapsed content wrapper (background-agnostic — no opaque gradient overlay).
- [ ] 1.9 Add content region id via `useId` and wire to the toggle's `aria-controls`.

## 2. Tests for new primitive

- [ ] 2.1 Add `Collapsible.test.tsx` covering: no-overflow case hides toggle, overflow case shows toggle, toggle flips expanded state (uncontrolled), controlled prop wins over internal state, `onExpandedChange` fires with correct next value.
- [ ] 2.2 Add test asserting `aria-expanded` reflects state and `aria-controls` references the rendered content id.
- [ ] 2.3 Add test asserting collapsed children remain in the DOM (full text queryable) even when clamped visually.
- [ ] 2.4 Add a `ResizeObserver` re-measurement test: simulate container resize that removes overflow → toggle becomes hidden without re-render by consumer.
- [ ] 2.5 Add reduced-motion test: under `prefers-reduced-motion: reduce`, the wrapper transition is absent / zero duration.

## 3. Barrel / exports

- [ ] 3.1 Add `export { Collapsible } from "./Collapsible"` via the nearest typography barrel (`package/ui/src/primitive/typography/index.ts`) or direct subpath export, matching the repo's current export conventions for other primitives.
- [ ] 3.2 Verify `Collapsible` is reachable from consumer packages via `@rezics/ui/...` subpath import consistent with how `CollapsibleByLineTextContainer` is currently imported.

## 4. Call-site migration

- [ ] 4.1 Repo-wide sweep: `rg "CollapsibleText|CollapsibleByLineText|collapsible-text"` under `package/` to confirm the consumer set. Expected initial set: `SingleExcerpt.tsx`, `SingleRemark.tsx`; update this task list if any are missed.
- [ ] 4.2 Migrate `package/app/src/review/components/SingleExcerpt.tsx` to use `<Collapsible maxLines={…}>`; when markdown is needed, render `<MarkdownContent>` as the child rather than passing `content`.
- [ ] 4.3 Migrate `package/app/src/review/components/SingleRemark.tsx` to `<Collapsible maxLines={…}>` with the same markdown-as-children pattern.
- [ ] 4.4 Visually verify the migrated review cards on the app: (a) short review shows no toggle, (b) long review shows toggle below content with no background mismatch on card / hovered card / dark mode, (c) expand/collapse animates, (d) language switch re-measures correctly.

## 5. Remove legacy primitive

- [ ] 5.1 Delete `package/ui/src/primitive/typography/collapsible-text/CollapsibleText.tsx`.
- [ ] 5.2 Delete `package/ui/src/primitive/typography/collapsible-text/CollapsibleByLineText.tsx`.
- [ ] 5.3 Delete `package/ui/src/primitive/typography/collapsible-text/CollapsibleText.test.tsx`.
- [ ] 5.4 Remove the now-empty `collapsible-text/` directory.
- [ ] 5.5 Remove any barrel re-exports referencing the deleted symbols.
- [ ] 5.6 Re-run `rg "CollapsibleText|CollapsibleByLineText|collapsible-text"` to confirm no stale references remain.

## 6. Validation

- [ ] 6.1 `bun run knip` at repo root reports no new unused exports in `@rezics/ui`.
- [ ] 6.2 Run `tsc --noEmit` inside `package/ui` — no type errors.
- [ ] 6.3 Run `tsc --noEmit` inside `package/app` — no type errors.
- [ ] 6.4 `bun test` in `package/ui` — new `Collapsible.test.tsx` passes; legacy test no longer exists.
- [ ] 6.5 `bun run format:check` in affected packages passes.
- [ ] 6.6 Manual browser verification of review list, review excerpt page, and any other surface that previously used the legacy primitive — no background bleed, no always-on toggle, correct clamping.
