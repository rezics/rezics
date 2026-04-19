## Context

`@rezics/ui` currently ships a primitive at `package/ui/src/primitive/typography/collapsible-text/CollapsibleText.tsx` that exposes `CollapsibleTextShow` (controlled) and `CollapsibleTextContainer` (uncontrolled). Both operate on a `content: string`, truncate via `String.prototype.slice` at a character `threshold` (default 200), and render the toggle inline with the ellipsis as a MUI `<Link component="button">`. Consumers include description previews for book / realm / shelf / review / author surfaces.

Three failure modes have surfaced in the product:

1. Toggle appears on content that visually fits in one line (character count ≠ visual lines).
2. Toggle never disappears when the container widens to fit the whole string (no overflow detection — it only looks at the raw string length).
3. The toggle's background clashes with various parent surfaces because `<Link component="button">` renders a real `<button>` element whose UA default background leaks through.

The call sites also need to host rich content (Typography variants, inline icons, translated strings) but the API forces raw string input.

This change replaces the primitive with `<Collapsible>` under `package/ui/src/primitive/typography/collapsible/`. All consumers migrate in the same change; no compatibility shim is added.

## Goals / Non-Goals

**Goals:**

- Correct truncation semantics: truncate by **visual line count**, not string length.
- Correct visibility semantics: the toggle is rendered **iff** the collapsed content actually overflows its container at the current width.
- Correct styling semantics: toggle is a transparent-background text affordance that inherits theme colors, rendered below the content, not inline with an ellipsis.
- `children`-based API that accepts any `ReactNode` (Typography, markdown output, mixed nodes).
- Smooth expand/collapse with reduced-motion respect and no layout jank.
- SSR-safe: no hydration mismatch when measurement on the client disagrees with the server render.

**Non-Goals:**

- No markdown/HTML renderer inside this primitive — callers pass already-rendered children.
- No support for truncating to a specific character count — callers wanting that should slice upstream.
- No "read more ... read less" routing/page expansion behavior (that is a separate concern handled by review/detail pages).
- No backward-compatibility shim re-exporting the old names. Call sites migrate in the same change.
- No new runtime dependency (no polyfill for `ResizeObserver` — modern browser targets only).

## Decisions

### D1. Truncation: CSS `-webkit-line-clamp`, not JavaScript string slicing

**Decision:** Collapsed state uses `display: -webkit-box; -webkit-line-clamp: var(--max-lines); -webkit-box-orient: vertical; overflow: hidden;`. Full children always remain in the DOM; the clamp is purely visual.

**Why:**

- Character counting cannot express "fit three lines of rendered text in this container at this font size at this width." Line-clamp does exactly that and is resolution/layout-native.
- Children stay in the DOM, so assistive tech still reads the full content regardless of collapsed state.
- Consistent across CJK / emoji / variable-width glyphs.

**Alternative considered:** measure text with a hidden canvas / duplicate node, compute truncation index, slice children. Rejected — slicing `ReactNode` children is infeasible in general (not just strings), and the measurement dance is expensive and fragile under re-layout.

**Alternative considered:** keep character-threshold API as a secondary mode. Rejected — carries forward the broken mental model. If a caller truly needs char-based cut, they can slice before passing children.

**Note on `-webkit-` prefix:** `-webkit-line-clamp` is standardized (CSS Overflow Module Level 3) and works unprefixed in modern engines, but the box-orientation combo still requires `-webkit-box-orient: vertical` on current Blink/WebKit. The CSS remains valid and functional; we apply both the prefixed and standard `line-clamp` in the class.

### D2. Overflow detection: `ResizeObserver`, not element counting or `useEffect`

**Decision:** Observe the content element with `ResizeObserver`. On each callback, compare `scrollHeight` (un-clamped intrinsic height) vs `clientHeight` (clamped box height). If `scrollHeight - clientHeight > 1`, the content is overflowing → render the toggle. Otherwise, hide it.

**Why:**

- Overflow depends on **container width** and **font metrics**, both of which change outside React's render cycle (window resize, parent flex reflow, font load, i18n switch). `ResizeObserver` is the only signal that fires on all of them.
- `useEffect` with `[children]` dependency misses width-only changes. Explicit `window.resize` listeners miss parent-driven reflows (a sidebar toggle, tab switch, accordion open).
- The `scrollHeight > clientHeight` comparison must be done while the element is in its **collapsed** state (otherwise `scrollHeight === clientHeight` trivially). We keep the clamp class on the measurement ref and read the two heights from it.

**Alternative considered:** count the rendered `<br>` or character-count heuristic. Rejected — unreliable with wrapped text.

### D3. Toggle placement and element: MUI `<Button variant="text">` below the content, not `<Link component="button">` inline

**Decision:** Toggle is a separate row below the content, rendered as MUI `<Button variant="text" size="small" disableRipple>` with `sx={{ px: 0, minWidth: 0, textTransform: 'none', fontWeight: 500 }}`. Alignment controlled by `alignToggle: 'start' | 'end'`, defaulting to `'start'`.

**Why:**

- Separate row preserves typographic rhythm. Inline "…展開" breaks the flow and collides with line-clamp (the ellipsis is managed by CSS, not by text).
- `<Button variant="text">` has transparent background by default and inherits theme palette. It does not carry the UA button background artifact that `<Link component="button">` produces.
- `disableRipple` and `sx` overrides strip MUI's button defaults that would visually announce it as a chunky button; the goal is a subtle text affordance.

**Alternative considered:** plain `<span onClick>` with `role="button"`. Rejected — re-implementing keyboard + focus + disabled state is wasteful when MUI provides it, and the repo convention is "MUI first."

**Alternative considered:** keep a link-style affordance but via `<Typography component="button" sx={{ background: 'transparent', border: 0, padding: 0 }}>`. Rejected — circumvents MUI theming; the Button primitive is the right abstraction.

### D4. Fade edge: `mask-image`, not overlaid gradient

**Decision:** Optional `fade` prop applies `mask-image: linear-gradient(to bottom, black 0%, black 85%, transparent 100%)` to the content wrapper when collapsed. No absolute-positioned `::after` with a solid-color gradient.

**Why:**

- An overlay gradient must know the parent background color to fade convincingly. In this codebase surfaces have varying backgrounds (cards, page surfaces, modal sheets, hover states), and parameterizing the gradient by ambient background is exactly the bug class this proposal is fixing.
- `mask-image` fades the content's own opacity. It is background-agnostic and correct under any parent surface, dark mode, and hover/selected states.
- `-webkit-mask-image` is the historical form; both names are emitted for cross-engine coverage.

**Alternative considered:** CSS `background: linear-gradient(...)` on a `::after` pseudo-element with `var(--bg)`. Rejected for the reason above — it solves the wrong problem.

### D5. Expand/collapse animation: grid template rows trick

**Decision:** The wrapper uses `display: grid; grid-template-rows: 0fr;` when collapsed and `grid-template-rows: 1fr;` when expanded. The inner content has `overflow: hidden`. Transition is on `grid-template-rows` (220 ms ease).

**Why:**

- `max-height` animation requires guessing a value larger than any possible expanded height. Too-large values produce lazy-feeling tail animations; too-small clip the content.
- Native `height: auto` does not animate.
- The `0fr → 1fr` grid pattern animates to the content's intrinsic height without measurement. Browser support is current-generation (Chrome 117+, Safari 17.4+, Firefox 124+) — aligned with this repo's targets.
- Honor `@media (prefers-reduced-motion: reduce)` by disabling the transition.

**Alternative considered:** measure `scrollHeight` on expand, set `max-height` in px, then switch to `max-height: none` after the transition. Rejected — more state, more edge cases (resize during transition), and the grid pattern is the modern idiom.

### D6. Controlled and uncontrolled modes

**Decision:** Props `expanded?: boolean` and `onExpandedChange?: (next: boolean) => void`. If `expanded` is provided, the component is controlled; otherwise it manages internal state (`useState(false)`).

**Why:** Two call-site patterns exist — isolated per-card state (uncontrolled) and group-level synchronized expand (e.g. "expand all reviews" button) which needs controlled.

### D7. SSR-safe initial render

**Decision:** On the server and during the first client render, assume the content overflows and render the toggle in its collapsed form. After `useLayoutEffect` fires on the client, measure with `ResizeObserver` and hide the toggle if no overflow.

**Why:**

- We cannot measure on the server. Assuming "toggle shown" is safe because the worst case is a brief post-hydration flicker where an unnecessary toggle vanishes. Assuming "no toggle" would flash a suddenly-appearing toggle, which reads worse.
- `useLayoutEffect` runs before paint on the client, so in most cases the toggle is hidden before the user sees the first frame.
- To avoid hydration mismatch from conditional rendering, the toggle is always rendered in the DOM but its visibility is controlled via a CSS class (`hidden` = `display: none`). The `data-overflowing` attribute drives the class.

### D8. Accessibility

**Decision:**

- Toggle has `aria-expanded={isExpanded}` and `aria-controls={contentId}` (an id generated via `useId`).
- Collapsed content keeps `aria-hidden={false}`: the full children are in the DOM and readable by screen readers regardless of visual clamp.
- Focus is not managed programmatically on toggle click (no focus trap).

**Why:** The primitive is about visual density, not information hiding. AT users should hear the full text; the toggle exists for sighted users to manage screen space.

### D9. Location and exports

**Decision:** Place the component at `package/ui/src/primitive/typography/collapsible/Collapsible.tsx`, with a sibling `Collapsible.test.tsx`. Export from the package root under the existing typography barrel (preserving the repo's current export structure). Remove the `collapsible-text/` directory entirely.

**Why:** Folder rename reflects the scope broadening (no longer only text). Deleting the old directory prevents accidental imports of stale symbols.

## Risks / Trade-offs

- **Risk:** `-webkit-line-clamp` + `-webkit-box` still requires the vendor-prefixed box orientation. → **Mitigation:** This is not a polyfill concern; it's the current standard behavior on all targeted engines. The class contains both the prefixed and the standardized `line-clamp` declaration.
- **Risk:** `grid-template-rows: 0fr ↔ 1fr` animation is unsupported on older browsers. → **Mitigation:** Repo targets modern evergreen browsers only. On unsupported engines, the transition degrades to an instant switch — the component remains functional.
- **Risk:** `ResizeObserver` fires synchronously during layout; measuring and then `setState` in the callback can cause a loop. → **Mitigation:** Guard the state update (`if (next !== prev) setOverflowing(next)`), and never mutate layout inside the observer callback.
- **Risk:** Flash of toggle on first client render followed by its disappearance (when content fits). → **Mitigation:** Use `useLayoutEffect` (pre-paint), not `useEffect`. In practice the flash is imperceptible.
- **Trade-off:** `mask-image` fade means the last line visibly fades to transparent, which is stylistically different from the typical "solid `…`" cut. This is a deliberate choice aligned with the Apple-inspired visual language the product is moving toward; reviewers who prefer hard cuts can pass `fade={false}`.
- **Trade-off:** Migration of all call sites in one change means the reviewer must pick an appropriate `maxLines` per site. No programmatic translation from the old `threshold` (chars) exists. This is acknowledged and documented in the tasks checklist.

## Migration Plan

1. Land the new `<Collapsible>` primitive behind its own new path — no export from the UI barrel yet.
2. Migrate call sites one directory at a time (book, realm, shelf, review, author, misc), committing each migration incrementally; verify each surface visually.
3. Wire up the barrel export for `<Collapsible>` after all call sites are migrated.
4. Remove the old `collapsible-text/` directory and its symbols from the barrel.
5. Run `bun run knip` per affected package to confirm no stale imports remain.

**Rollback:** Revert the merge. The primitive is internal; no external consumers.

## Open Questions

- Should the default `maxLines` be `3` or require callers to set it explicitly? → **Proposed:** require explicit `maxLines` (no default). Encourages deliberate layout decisions per surface. Open for the reviewer.
- Should the toggle labels ("Show more" / "Show less") be i18n keys, or props? → **Proposed:** props with sensible defaults (`showMoreLabel` / `showLessLabel`) that default to the current locale via an optional `useTranslate`–style hook if available, else English fallback. The primitive lives in `@rezics/ui` which has no i18n dependency; keeping it string-prop-based avoids coupling the UI package to the app's i18n layer.
