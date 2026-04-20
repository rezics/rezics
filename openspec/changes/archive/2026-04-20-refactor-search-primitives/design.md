## Context

The search feature in `package/app/src/search` evolved from two overlapping efforts (`SearchInfo`-based book search and the later `SearchQuery`-based unified search). The result is a Russian-doll of wrappers that each re-express the same controls:

- `SearchInput` / `SearchInputView` — bundle keyword + tags (comma TextField) + word count + NSFW + licensed + tag-group suggestion in one monolith, plus a URL-sync `useEffect` scoped to `/book`.
- `SearchPanel` / `SearchPanelView` — a thin MVP wrapper on top of `SearchInput` + `SearchFilter`.
- `BookSearchInput` — another thin wrapper that merely passes `placeholder` and a sort state.
- `AdvancedSearch` — does **not** compose `SearchInput`; it re-implements keyword / tags / type / sort / nsfw / licensed from scratch, with its own tags TextField.
- `BasicSearch` — yet another small shell with its own keyword field + `AppliedFilterChips`.
- `SelectedTagChips` (in `@/tag`) — renders `InjectedTag[]` as display-only chips, used on `BookLibSection` alongside `BookSearchInput`, so the "tags" concept is split across two independent components.

This structure blocks three things the product now needs:

1. **Domain-specific basic search surfaces** (book vs review vs realm vs user units) that pick their own mix of controls.
2. **A single shared advanced panel** that is the authoritative filter surface and includes global dimensions (`type`, `postKind`).
3. **A coherent tag input** — today slugs are typed as `"a, b, c"` into a plain TextField, which is unusable as a filter control.

The refactor introduces primitive components + a state hook, and reshapes every existing composer (`BookSearch`, `ReviewSearch`, `AdvancedSearch`, and the various search pages) to assemble primitives directly.

## Goals / Non-Goals

**Goals:**

- Pure, controlled primitives per filter dimension. No primitive owns state or knows about the `SearchQuery` shape's full schema.
- One state home per search session via `useSearchQuery`, living at the page layer so basic↔advanced mode switching preserves query state.
- One canonical query shape (`SearchQuery`) and one mapper (`toContentSearchOptions`). Retire `SearchInfo`.
- Unified "injection" model: `initial` (visible) vs `implicitInitial` (hidden in basic). Pre-applied zone filters and router-injected tags both flow through this.
- A real `TagPicker` with chip display, slug-comma input, and server-backed slug autocomplete (temporary endpoint, marked for Meilisearch migration).
- Typed query string support lives as an opt-in `middleware` prop on `KeywordInput`, fires on submit only, appends never replaces.

**Non-Goals:**

- Changing the server / contract surface (`ContentSearchOptions`, `SearchQuery` in `@rezics/contract`) — unchanged.
- Building the Meilisearch tag-index system in this change (tracked by inline `TODO:` only).
- Redesigning the visual aesthetic of search pages — same layout, different component boundaries.
- Internationalization key cleanup — existing `search.input.*` keys are reused where semantically equivalent; new primitives introduce new keys only where necessary.
- Admin-panel search (admin package) — out of scope; this change only touches `package/app`.

## Decisions

### D1. Primitives are pure, controlled, and unaware of `SearchQuery`

Every primitive exposes `{ value, onChange, ...display props }`. No primitive calls a hook that owns search state; no primitive imports the `SearchQuery` type (except `KeywordInput`'s optional middleware path, which is generic over the patch shape).

**Alternative considered:** primitives that auto-bind to a context-provided search state (reduced boilerplate). **Rejected** because it hides the data flow, fights React devtools, and couples every primitive to the feature's state management.

### D2. `useSearchQuery` is a plain hook, home is the page layer

```ts
function useSearchQuery(opts: {
  initial?: Partial<SearchQuery>;
  implicitInitial?: Partial<SearchQuery>;
  middleware?: QueryMiddleware;
}): {
  query: SearchQuery;
  implicit: Partial<SearchQuery>;
  patch: (p: Partial<SearchQuery>) => void;
  bind: <K extends keyof SearchQuery>(key: K) => { value: SearchQuery[K]; onChange: (v: SearchQuery[K]) => void };
  toOptions: () => ContentSearchOptions;
};
```

Composers read `query` via `bind(field)`; they never call `useSearchQuery` themselves. The page owns the hook and passes primitives the bindings they need.

**Alternative considered:** Jotai atom per search session. **Rejected** for this refactor because the scope is one page's worth of state and the hook is simpler to reason about / easier to unit test. We can re-evaluate if cross-component sync pressure grows.

### D3. Mode switching (basic ↔ advanced) is a page-level concern

The page holds `useSearchQuery` + a `useState<'basic' | 'advanced'>`. It renders either its domain `BasicXSearch` composer (e.g., `BookSearch`) or the shared `AdvancedSearch` composer, passing both the same `query`, `bind`, `patch`, `implicit`, and submit handler. Switching mode only swaps which composer is mounted; query state is unaffected because it lives above both.

**Alternative considered:** each composer owns its own `useState` and mode. **Rejected** because switching would reset the query or require URL-roundtripping to preserve it — both are worse UX and more code.

### D4. "Pre-applied" is renamed to `implicitInitial`

The display rule:

- `initial` (visible everywhere): route state, URL params, defaults.
- `implicitInitial` (hidden in basic mode): zone / scope filters.

In **basic mode** a composer renders `<AppliedFilterChips query hide={implicit} rendered={[...]} />` to echo filter values that are **not** implicit and **not** already surfaced by a rendered primitive. In **advanced mode** every dimension has its own primitive, so the chips component is unused (or renders nothing because `rendered` covers everything).

**Alternative considered:** keep `preAppliedFilters` + `injectedTags` as separate concepts. **Rejected** — they are the same concept (a filter provided to the session without the user typing it); the only real difference is display policy, which the `implicit` / `initial` distinction captures directly.

### D5. Single canonical query shape: `SearchQuery`

`SearchInfo` is deleted. All composers use `Partial<SearchQuery>` (from `@rezics/contract`) as their state model. `toContentSearchOptions(query: SearchQuery): ContentSearchOptions` is the only boundary mapper; we move it into `search/models/toContentSearchOptions.ts`.

**Alternative considered:** keep `SearchInfo` as a "basic" subset. **Rejected** — it is a strict subset with different field names (`textLength` vs `wordCount`, `tags: string[]` vs `tags: SlugRef[]`), causing bugs at the boundary. A single shape with optional fields expresses the same constraints without the aliasing.

### D6. Typed query string is a `KeywordInput` middleware that fires on submit

`KeywordInput` accepts an opt-in `middleware?: (raw: string) => Partial<SearchQuery> | null`.

```
on Enter key or Search button:
  parsed = middleware?.(keyword)
  if (parsed) onPatch(mergeAppend(currentQuery, parsed))
  else        onChange(keyword)
```

Merge rules for `mergeAppend`:

- `tags`, `type`, `postKind`, `languages` — union with dedupe by identity key (`slug` for tags, the value itself for string enums).
- `keyword` — overwritten with parser's residual text.
- scalars (`nsfw`, `isLicensed`, `sort`, `textLength`, `realm`) — overwritten if the parser produced a value, otherwise left untouched.

**Alternative considered:** fire on every keystroke. **Rejected** — creates ghost state when the user edits / backspaces a token; the model cannot "un-apply" what the last keystroke appended. Submit-time firing matches user intent ("apply this query now") and sidesteps the ghost-state problem.

**Alternative considered:** parser replaces rather than appends. **Rejected** — would silently clobber route-injected and URL-injected filters whenever the user typed any text with a parser-recognized token.

### D7. `AdvancedSearch` is the single shared advanced composer

It lives in `search/components/AdvancedSearch.tsx` and is the only component that renders the full filter set. It explicitly includes primitives for content type (`ContentTypeCheckboxes`) and post kind (`PostKindCheckboxes`), and any future global dimensions added to `SearchQuery` land here first.

**Alternative considered:** per-domain advanced composers (`BookAdvancedSearch`, `ReviewAdvancedSearch`). **Rejected** — advanced mode's defining purpose is "expose everything", so fragmenting it defeats its point.

### D8. Basic composers are per-domain and live in their own feature folder

- `book-library/components/BookSearch/BookSearch.tsx` — keyword + tags + word count + nsfw + licensed + tag-group suggestions.
- `review/components/ReviewSearch/ReviewSearch.tsx` — keyword + tags (and whatever review-specific dimensions exist).
- Future domains follow the same template.

Each basic composer renders `<AppliedFilterChips>` to surface residual non-implicit filters.

**Alternative considered:** a parameterised `BasicSearch` that takes a list of primitive names. **Rejected** — the variations are small enough that explicit composition is clearer than a config-driven primitive picker.

### D9. `TagPicker` — chip display, slug,comma input, server-backed autocomplete

Shape:

```tsx
<TagPicker
  value={SlugRef[]}             // from SearchQuery.tags
  onChange={(next: SlugRef[]) => void}
  hiddenSlugs?: string[]        // suppress chips for implicit tags in display
/>
```

Input parsing rules:

- Typing a bare token + `,` or Enter adds a chip `{ slug }`.
- Pasting `a, b, c,` splits into `[{slug:"a"},{slug:"b"},{slug:"c"}]`.
- Autocomplete suggestions come from a server call; selecting a suggestion adds a chip with `{ slug, unitId, name }` if those fields are returned.

The server call is implemented as a `useTagSuggest(query)` hook against an existing tag endpoint. `TagPicker.tsx` carries an inline `// TODO:` noting the intended migration to a Meilisearch tag index.

**Alternative considered:** use MUI `Autocomplete` with `multiple` + `freeSolo`. **Accepted** — this is the underlying primitive we wrap. The "slug,comma" paste behavior is layered on top via a custom `onPaste` + `onKeyDown` handler.

### D10. `AppliedFilterChips` becomes a residual-display primitive

Props:

```tsx
<AppliedFilterChips
  query: SearchQuery
  hide?: Partial<SearchQuery>           // usually `implicit`
  rendered?: (keyof SearchQuery)[]      // fields already surfaced by primitives
  onRemove?: (field: keyof SearchQuery, value: unknown) => void
/>
```

It enumerates the diff `(query - hide) - rendered` and renders a chip per leftover value. In advanced mode `rendered` covers everything and the component renders nothing.

### D11. `SelectedTagChips` is deleted

Callsites (today `BookLibSection`) migrate to either:

- Direct use of `<TagPicker value={initial.tags} onChange={...} />` inside the composer, **or**
- `<AppliedFilterChips ... />` when the surface is a non-editable display.

For `BookLibSection` specifically, the `injectedTags` from router state are fed into `useSearchQuery({ initial: { tags: injectedTags.map(({slug,unitId,name}) => ({slug,unitId,name})) } })` — no separate chip component needed.

### D12. Per-page migration of URL sync

`SearchInput`'s `useEffect` that re-parsed `/book` URL params to re-initialize state is replaced by explicit page-layer logic:

```ts
const initial = parseBookSearchParams(location.search);
const { query, bind, patch, toOptions } = useSearchQuery({ initial });
```

When the user submits, the page-level `onSearch` handler calls `toOptions()` and navigates with serialized params. The URL is the source of truth on mount; `useSearchQuery` seeds from `initial` exactly once per navigation.

## Risks / Trade-offs

- **Risk:** Large single-PR refactor touches many pages (`BookLibSection`, four `*SearchPage.tsx`, `HomeSearchBar`, `UnitsPage`, `UserUnitsPage`). → **Mitigation:** The refactor is mechanical once primitives exist; each page's migration is a diff from `<SearchInput .../>` (or `<AdvancedSearch .../>`) to the new `useSearchQuery`-driven composer. We smoke-test each page as a task checkbox before archiving.
- **Risk:** Typed query string middleware semantics diverge from user expectation — appending vs replacing is a behavior change on pages that currently use `parseSearchString` to overwrite. → **Mitigation:** Document the rule in design and in `KeywordInput` JSDoc; middleware fires only on submit so the user has explicit intent.
- **Risk:** `TagPicker` server calls on every keystroke without debouncing could overload the tag endpoint. → **Mitigation:** Debounce autocomplete queries (250 ms) inside `useTagSuggest`.
- **Risk:** `AppliedFilterChips.rendered` is a manual list; if a composer forgets to include a field there, a primitive's value appears twice (once in the primitive, once in the chips). → **Mitigation:** lint-like snapshot test per composer that renders it with a fully-populated query and asserts no chip duplicates an input. Manual maintenance is acceptable given composer count is small.
- **Trade-off:** Deleting `SearchInfo` and the `SearchInput` surface is a one-shot break. Callsites fail loudly at compile time, which is what we want — there is no "v1 vs v2" coexistence period.
- **Trade-off:** Mode state lives on the page, not inside a context / URL param. This means a full page navigation resets mode to the page's default. We accept this for now; URL-driven mode can be added later if needed.

## Migration Plan

1. Land primitives + `useSearchQuery` + `AppliedFilterChips` (new) + `TagPicker` first in a single commit — compile-clean but unused.
2. Rewrite `AdvancedSearch` to consume primitives; migrate its callsites (`/search`, `/zone/:slug/search`).
3. Rewrite `BookSearch` composer; migrate `BookLibSection`, `HomeSearchBar`, `UnitsPage`, `UserUnitsPage`.
4. Rewrite `ReviewSearch` composer; migrate `ReviewSearchPage`, `ReviewsPage`.
5. Migrate remaining search pages (`RealmSearchPage`, `ShelfSearchPage`) to either `BookSearch`-style composer or direct `AdvancedSearch` usage per their current behavior.
6. Delete `SearchInput`, `SearchInputView`, `SearchPanel`, `SearchPanelView`, `BookSearchInput` (the old shell), generic `BasicSearch`, `SelectedTagChips`, `SearchInfo`, and the old `AppliedFilterChips` implementation once nothing imports them.
7. Run `bun run check:convention`, `tsc --noEmit` per affected package, and smoke-test each migrated page manually.

**Rollback strategy:** the change is a single PR. Revert by git-revert; no data migration, no server-side coupling.

## Open Questions

- Should basic-mode mode-toggle land on the keyboard as well (e.g., Cmd/Ctrl+Shift+A)? Tracked as follow-up, not blocking.
- Should `AppliedFilterChips` support grouping by dimension (e.g., "Tags: a, b, c" as one chip cluster) or stay one chip per value? Current decision: one chip per value; revisit if density becomes a problem.
- Do we need a `bind`-style helper for the `onPatch` middleware path (so `KeywordInput` can take `{...bindPatch('keyword')}` instead of explicit `value / onChange / onPatch`)? Current decision: leave explicit until second composer asks for it.
