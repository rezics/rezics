## Why

The `collapsible-text/` directory in `@rezics/ui` ships **two** overlapping primitives — `CollapsibleText` (character-based) and `CollapsibleByLineText` (line-based, an incremental rewrite). Together they expose `CollapsibleTextShow`, `CollapsibleTextContainer`, `CollapsibleByLineTextShow`, `CollapsibleByLineTextContainer`. Both are wrong in different ways, and the line-based one still reproduces the visual-bleed artifact the user called out:

1. **Truncation unit mis-modeled in the character-based primitive.** `CollapsibleText` compares `content.length > threshold`, which misjudges CJK / emoji / rich markup, and any caller passing a low threshold gets a "Show more" link on content that visually fits in one line.
2. **Overflow detection is one-shot and non-reactive in the line-based primitive.** `CollapsibleByLineText` measures with a single `useEffect + requestAnimationFrame` at mount. It does not re-measure on container resize, font load, i18n language switch, or children change — so widening a container does not hide the toggle, and narrowing does not reveal one.
3. **Toggle styling is broken in both.** `CollapsibleText` uses a MUI `<Link component="button">` inline with the ellipsis — the underlying `<button>` element carries a UA background that bleeds through. `CollapsibleByLineText` renders the toggle absolutely positioned inside an overlay whose background is hardcoded to `theme.palette.background.default` via a gradient — this is exactly the "background color doesn't match" artifact the user reported, because any surface other than the page's default paper (cards, hovered rows, modals, dark-mode variants) leaves a visibly mismatched rectangle behind the toggle.
4. **Hardcoded colors and i18n coupling.** `CollapsibleByLineText` hardcodes Tailwind `text-blue-600` and pulls in `react-i18next` — a shared UI primitive should not be bound to a specific i18n framework or bypass the MUI palette.
5. **Markdown rendering baked into the primitive.** `CollapsibleByLineText` imports `MarkdownContent` and branches on `content` vs `children`. A truncation primitive should not own content interpretation; callers render markdown upstream and pass the rendered node as children.

This change replaces the primitive with a new `<Collapsible>` component that uses CSS line-clamping, measures real overflow via `ResizeObserver`, and styles the toggle as a subtle text button below the content — matching the Apple-inspired visual language already adopted elsewhere in the product.

## What Changes

- **BREAKING**: Remove the entire `package/ui/src/primitive/typography/collapsible-text/` directory and its exports (`CollapsibleTextShow`, `CollapsibleTextContainer`, `CollapsibleByLineTextShow`, `CollapsibleByLineTextContainer`).
- Add a new primitive `<Collapsible>` under `package/ui/src/primitive/typography/collapsible/`:
  - `children`-based API (accepts any `ReactNode`, not a raw string).
  - `maxLines` prop (visual-line truncation via CSS `-webkit-line-clamp` + `-webkit-box-orient`).
  - Overflow detection via `ResizeObserver` comparing `scrollHeight` vs `clientHeight` in the collapsed state. Toggle is rendered only when the content actually overflows.
  - Toggle rendered **below** the content as a transparent-background MUI text button (no `<Link component="button">`), right- or start-aligned via `alignToggle` prop.
  - Optional `fade` prop applying a `mask-image` gradient to the last visible line when collapsed (no opaque overlay — avoids container-background assumptions).
  - Height transition via the modern `grid-template-rows: 0fr ↔ 1fr` pattern; honors `prefers-reduced-motion`.
  - Controlled (`expanded` / `onExpandedChange`) and uncontrolled modes.
  - Accessibility: toggle carries `aria-expanded` and `aria-controls`; collapsed children remain in the DOM so screen readers can read the full text.
  - SSR: initial render assumes overflow (toggle shown); client hydration re-measures and hides the toggle if there is no overflow, without hydration mismatch.
- Migrate every call site of the removed symbols to `<Collapsible>`. Known consumers at proposal time:
  - `package/app/src/review/components/SingleExcerpt.tsx` — `CollapsibleByLineTextContainer`.
  - `package/app/src/review/components/SingleRemark.tsx` — `CollapsibleByLineTextContainer`.
  - A repo-wide sweep SHALL be part of the task list to ensure no further consumers are missed.
- Remove legacy test file `CollapsibleText.test.tsx`; add tests for the new component covering: no-overflow case, overflow case, controlled/uncontrolled, SSR-safe measurement, resize re-measurement, `prefers-reduced-motion`.
- Markdown rendering is moved out of the primitive — callers that currently rely on the primitive's internal `MarkdownContent` SHALL render markdown upstream and pass the rendered node as children.

## Capabilities

### New Capabilities

- `ui-collapsible`: Shared primitive for collapsing long-form text / rich content to a fixed number of visual lines, with overflow-aware toggle rendering, Apple-style fade, and smooth expand/collapse animation. Lives in `@rezics/ui`.

### Modified Capabilities

<!-- None. The primitive is new; removal of `CollapsibleText` is not a spec-level behavior since the old primitive has no dedicated spec in `openspec/specs/`. -->

## Impact

**Affected packages**

- `package/ui` — new primitive, removal of old one, tests.
- `package/app` — call sites migrated (book description, realm description, shelf description, author bio, review bodies; exact set enumerated in `tasks.md`).
- `package/admin` — any description previews that use the primitive (audited during migration).

**APIs / dependencies**

- No backend or contract changes.
- No new runtime dependencies. `ResizeObserver` is assumed available (already a runtime target; no polyfill added).

**Backward compatibility**

- **BREAKING** within the monorepo: the exported symbols `CollapsibleTextShow` and `CollapsibleTextContainer` are removed. All call sites are migrated in the same change; no compatibility shim is added (per repo convention — no "backwards-compat hacks").
- No external consumers (`@rezics/ui` is an internal workspace package).

**Migration**

- Every `<CollapsibleTextShow>` / `<CollapsibleTextContainer content={s} threshold={n}/>` becomes `<Collapsible maxLines={k}>{s}</Collapsible>`. `threshold` (characters) is not 1:1 to `maxLines` (visual rows); per site the reviewer picks a reasonable `maxLines` based on the current layout (typical: 3 for card summaries, 4–5 for detail pages).
