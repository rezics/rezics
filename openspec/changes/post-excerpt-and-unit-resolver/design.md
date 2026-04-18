## Context

Three current-state observations frame the design:

1. **Loose contract.** `package/contract/src/post.ts` types `postListQuerySchema.kind` as `t.Optional(t.String())`, and `package/server/src/post/post.service.ts:35` does `where.kind = query.kind as PostKind`. Any string passes type checking and reaches Prisma, which then rejects with an opaque enum error. Three frontend call sites currently send `'review'` / `'remark'` (lowercase), which is the trigger for the visible bug.

2. **Half-renamed `QUOTE`.** The PostKind enum still says `QUOTE`, but components are named `QuoteExcerptList`, `QuoteExcerptPreview`, `SingleQuoteExcerpt` — a sign the code already wants to be called "excerpt." The existing `post-kind-contract` and `type-extension-post` specs explicitly enumerate `quote` as a valid `kindKey`, so the rename has to land in the specs as well as the code.

3. **`/unit/:unitId` is a typed page, not a primitive.** Today it renders a generic Unit detail. With excerpts about to start citing units by id, the same id needs to resolve cleanly to whatever typed page the unit belongs on — book, chapter, shelf, review, etc. — without the citing code having to know the unit's type.

The four pieces (contract tightening, rename, source field, resolver refactor) share call sites and review surfaces (`buildUrl`, the post editor, the post detail renderer), which is why they ship as one change rather than four.

## Goals / Non-Goals

**Goals:**
- Eliminate the runtime `kind` failure at its root by removing the unsafe cast and narrowing the contract type, not by patching three call sites.
- Commit fully to `EXCERPT` across enum, contract, routes, components, directories, i18n, seed, `buildUrl`, and Meili — no hybrid `QuoteExcerpt*` names remain.
- Give excerpt posts a typed source that supports both internal unit references (resolved late, robust to renames) and arbitrary URLs (frozen, protected by the global `<Link>` primitive).
- Make `/unit/:unitId` a true resolver: `buildUrl` is the single source of truth for type → route mapping, and any unit type without a typed page falls through to a generic `/unit/:unitId/view`.
- Author UX for picking a source is URL-first with optional tree picker; citation title is a free-form snapshot.

**Non-Goals:**
- No `/quote/...` → `/excerpt/...` redirect or route alias. Clean break.
- No history or version tracking for `source` updates. A source change is in-place like any other post field.
- No discriminated `postExtraSchema` per kind — the shared `extra` object grows one optional `source` field. Type-enforcing "only EXCERPT has source" is deferred.
- No backend ancestry constraint between `targetUnitId` and `source.unitId`. The convention says "the source is inside the work," but the validator does not enforce it. Cross-work citation is acceptable.
- No data migration beyond the `QUOTE` → `EXCERPT` enum rename. Existing posts without `extra.source` simply render without the source link.
- No tracking-parameter stripping, URL preview, or unfurl on hover for `source.url`. The renderer just routes through `<Link>` and inherits whatever protection the global primitive provides.
- The `outbound-link-protection` change (which introduces `<Link>`) is a *prerequisite*, not a deliverable of this change.

## Decisions

### D1 — Tighten the contract; let TypeScript flag the call sites

**Decision:** Change `postListQuerySchema.kind` to `t.Optional(postKindLiterals)`. Drop the `as PostKind` cast in `post.service.ts`. The TypeScript compiler then surfaces the three lowercase frontend call sites; fix each to use `PostKind.REVIEW` / `PostKind.REMARK`.

**Why over patching call sites first:** A call-site patch leaves the loose contract in place. The next contributor writes the same lowercase literal and hits the same runtime error. Tightening the type is the actual fix; the call-site fixes fall out of compile errors.

**Why over loosening the backend further:** Casting harder (`String(query.kind).toUpperCase()`) silently accepts garbage and forwards it to Prisma. The contract is the right place to define what's valid.

### D2 — `EXCERPT` rename: clean break, one-shot data migration, no compatibility shims

**Decision:** Every reference to `QUOTE` migrates to `EXCERPT` in one change. Database: `UPDATE Post SET kind = 'EXCERPT' WHERE kind = 'QUOTE'`. Routes: `/quote/$unitId` becomes `/excerpt/$unitId`. No 301s, no enum aliases, no "accept both" code.

**Alternatives considered:**
- *Dual-key acceptance period.* Backend accepts both `QUOTE` and `EXCERPT`, frontend writes only `EXCERPT`, deprecate `QUOTE` later. Rejected — adds a permanent code path that takes a follow-up change to remove. The codebase has no external API consumers that would benefit.
- *Route aliasing only.* Keep `/quote/...` as a redirect. Rejected for the same reason — a temporary alias becomes permanent.

**Hybrid component names disappear.** `QuoteExcerptList` becomes `ExcerptList`, `SingleQuoteExcerpt` becomes `SingleExcerpt`. The hybrid was a signal that the underlying name was wrong; we honor the signal.

### D3 — Excerpt source as a discriminated union: `unit` vs `url`

**Decision:**

```ts
export const excerptSourceSchema = t.Union([
  t.Object({
    mode:   t.Literal('unit'),
    unitId: t.String(),
    title:  t.String({ minLength: 1, maxLength: 200 }),
  }),
  t.Object({
    mode:  t.Literal('url'),
    url:   t.String({ maxLength: 2048 }),
    title: t.String({ minLength: 1, maxLength: 200 }),
  }),
]);

export const postExtraSchema = t.Object({
  rating: t.Optional(t.Number()),
  title:  t.Optional(t.String()),
  book:   t.Optional(t.Object({ id: t.String(), title: t.String() })),
  source: t.Optional(excerptSourceSchema),
});
```

**Two modes, no domain restriction.**
- `unit` mode stores only a unitId. Render emits `<Link to="/unit/$unitId">{source.title}</Link>`. The resolver picks the typed destination at click time. This is the **stable** reference — survives unit renames, route restructures, and type changes.
- `url` mode stores any well-formed URL — rezics-domain or external. Render emits `<Link href={source.url}>{source.title}</Link>`. The global `<Link>` primitive (from `outbound-link-protection`) classifies the URL: rezics-domain → in-app navigation, external → confirmation modal. **The contract does not enforce a domain restriction.**

**Why no separate `'rezics-url'` and `'external-url'` modes:** Classification is a render-time concern that already lives in the global `<Link>` primitive. Splitting modes here would force authors and the editor UI to know the difference, which they don't need to.

**Why `unit` and `url` rather than collapsing to a single `url` mode:** The unit-resolver promise — "this id resolves to the right typed page even after restructures" — depends on storing the id, not the URL. A user who pastes `/unit/abc` into the URL field is offered an upgrade to `mode: 'unit'` (see D5). Storing the URL would freeze the citation at today's route shape and break under restructures.

### D4 — `targetUnitId` (work) vs `source.unitId` (location); loose ancestry

**Decision:** No backend constraint on `source.unitId`. Convention: it identifies the citation location (e.g., a chapter) inside the work named by the post's `targetUnitId`. The form picker defaults to a tree under `targetUnitId`. Cross-work citation is allowed — pick any unit.

**Alternatives considered:**
- *Strict ancestry check.* Validator requires `source.unitId` to descend from `targetUnitId` in the work hierarchy. Rejected — adds a join on every excerpt write, breaks if a chapter is reparented (data left over from before the rename), and rules out the legitimate "this passage echoes that other book" use case.
- *Fully decoupled (no `targetUnitId` requirement).* Rejected — `targetUnitId` is what powers "all excerpts of this book" lists and Meili filtering, which the rest of the app already depends on.

### D5 — Editor UX: URL-first with auto-classification, collapsed tree picker

**Decision:** The excerpt source field in the editor is one URL input by default. As the author types or pastes:

- If the input parses as an in-app `/unit/:id` route or a typed-page route that maps back to a unit (e.g., `/book/abc`, `/chapter/xyz`), the form **auto-extracts** the unit id, switches the stored value to `mode: 'unit'`, and pre-fills `title` from the unit's display name (still freely editable).
- Otherwise, the value is stored as `mode: 'url'` with the raw URL.
- A collapsed "Pick from this work" disclosure exposes a tree under `targetUnitId` for users who prefer browsing over pasting.

**Why URL-first over picker-first:** Most authors arrive at the editor with a URL in their clipboard (they were just on the page they want to cite). A URL field accepts that gesture directly. The tree picker stays available for deliberate browsing.

**Why auto-extract instead of dual entry:** A `mode: 'unit'` source survives restructures; a frozen URL doesn't. If the user pastes a URL we can recognize as internal, upgrading them to the stable form is a strict improvement at no UX cost.

**Why title pre-fill but freely editable:** Match what the original plan called out — the title is a snapshot of what the author wrote, not a live mirror of the unit. Pre-filling saves typing for the common case; making it editable preserves authorial voice (`《指環王》第三章，第一節` rather than the raw unit slug).

### D6 — Unit resolver: loader-driven redirect with `buildUrl` as single source of truth

**Decision:** `/unit/:unitId` becomes a route whose loader does:

```ts
loader: async ({ params, context }) => {
  const unit = await context.queryClient.ensureQueryData(
    unitQueries.detail(params.unitId),
  );
  if (!unit) throw notFound();
  if (!canAccessUnit(unit, context.viewer)) throw notFound();

  const dest = buildUrl(unit);
  if (dest) throw redirect({ to: dest.path, params: dest.params });

  throw redirect({
    to: '/unit/$unitId/view',
    params: { unitId: params.unitId },
  });
}
```

The page itself renders nothing — the loader always either redirects or throws.

`/unit/:unitId/view` absorbs the *current* generic renderer behavior. It is the fallback for unit types `buildUrl` cannot map (e.g., new unit types added later, or types with no typed page yet).

**Why `buildUrl` as the single source of truth:** It already maps unit type + post kind → route. Any future mapping (new UnitType, new PostKind) is added there once; the resolver inherits it. No parallel switch statement.

**Why a real route at `/view` rather than a query param or anchor:** A real route is bookmarkable, gives the user an honest URL ("you're on the generic renderer"), and lets routing tools surface it as a distinct destination. The query-param alternative blurs the resolver and the renderer.

**Why `ensureQueryData` not `fetchQuery`:** Warms the TanStack Query cache so the destination route mounts with data already available — no second fetch.

### D7 — Status / visibility rules mirror typed pages via `canAccessUnit`

**Decision:** A shared `canAccessUnit(unit, viewer)` helper enforces:
- DELETED → 404 for everyone (including owner).
- DRAFT / PRIVATE / UNLISTED → 404 for non-owner; redirect proceeds for owner.
- PUBLISHED + PUBLIC / UNLISTED → redirect proceeds for everyone.

The same helper is used by typed pages (book detail, post detail, etc.) so behavior cannot drift between the resolver and the destination.

**Why a single helper:** If the resolver said "redirect" but the typed page said "404," the user would see a flash of redirect followed by a 404 — confusing and inconsistent. One helper, one decision.

### D8 — Redirect-loop safety asserted by test

**Decision:** A single integration test asserts: for every UnitType, resolving from `/unit/:id` terminates in exactly one redirect. If a future typed page ever redirects back to `/unit/:id`, the test fails immediately.

**Why a test rather than runtime detection:** Detection at runtime (e.g., a max-redirect counter) would be load-bearing in production for a bug that should never ship. A test catches the bug at PR time.

### D9 — Source title is a snapshot, not a mirror

**Decision:** `source.title` is what the author wrote at post time. It does not auto-update when the linked unit's display name changes.

**Why:** The author wrote the citation as part of the post. If the unit later changes name (translation revision, retitle, etc.), the citation as the author wrote it is the historically correct text. The unit-id link still resolves to the new name, so navigation stays correct; only the citation text is frozen.

## Risks / Trade-offs

- **[Risk] Bookmarks at `/quote/...` 404 after the rename.** → Acknowledged. No external consumers we know of use these routes today, and the proposal explicitly opts out of redirect aliases. If real-world breakage surfaces post-launch, a tiny `/quote/$id` redirect can be added in a follow-up — cheap to add, expensive to remove if added preemptively.

- **[Risk] One-shot data migration is irreversible without an inverse migration.** → True. The migration is a single `UPDATE` that's easy to reverse manually if needed (`UPDATE Post SET kind = 'QUOTE' WHERE kind = 'EXCERPT'`). The implementation task includes a one-line note documenting the inverse for runbook purposes.

- **[Risk] `source.title` drift if the linked unit is renamed.** → Intentional per D9. The citation captures what the author wrote at the moment of citation. Surfaced to users implicitly: hovering the link shows the *current* unit name (browser behavior), while the visible text stays as written.

- **[Risk] `source.url` staleness if a rezics page moves or an external page dies.** → Same behavior as any other link in user content. No cascade, no repair. The post author can edit the source like any other field.

- **[Risk] `postExtraSchema` shape lets non-EXCERPT kinds set `source`.** → Possible. The shared `extra` object is loose by design (it already holds rating, title, book). If misuse becomes a real problem, a follow-up can discriminate `postExtraSchema` by kind. Not blocking.

- **[Risk] Auto-extract from URL paste mis-classifies an in-app path.** → A URL like `/book/abc` that maps to a typed page can usually be reversed to a unit id via the route table. If the reverse fails (e.g., a malformed slug), the form falls back to `mode: 'url'` and the user sees the link as-is. No data loss.

- **[Risk] Resolver behavior diverges from typed pages on visibility.** → Mitigated by D7 (single `canAccessUnit` helper). Documented as a hard rule in the spec — drift caught at review.

- **[Trade-off] Editor UX hides the unit picker by default.** → Some authors may prefer browsing first. The collapsed disclosure makes the picker discoverable but not in the way; if user research later shows the picker is the more common path, swap the defaults — schema and renderer are unaffected.

- **[Trade-off] Excerpt source rendering depends on `<Link>` from a separate change.** → If `outbound-link-protection` slips, this change cannot land cleanly. Acceptable: that change is small and self-contained, and the dependency is explicit in the proposal.

## Migration Plan

1. **Land contract tightening.** Narrow `postListQuerySchema.kind`, drop the cast, fix the three call sites. Verify the original bug is gone.
2. **Rename the enum and migrate data.** Single Prisma migration: enum value rename + `UPDATE Post`. Coordinate with seed scripts.
3. **Rename code.** Directories, components, routes, i18n keys, `buildUrl` case, Meili filter literal, mocks. Per-package `tsc --noEmit` after each package's rename.
4. **Add the source field.** Schema in `@rezics/contract`, validation in `post.api.ts`, editor UI for picking unit-mode vs url-mode (with auto-extract), renderer using `<Link>`.
5. **Land the unit resolver split.** Move current generic renderer to `/unit/$unitId/view`; replace `/unit/$unitId` with the loader-driven redirect. Add the `canAccessUnit` helper. Add the redirect-loop integration test.
6. **Validation pass.** Per-package tsc, `bun test`, `bun run check`, `bun run check:convention`. Manual smoke through the excerpt editor and the resolver flow.

Rollback: the rename and source addition can be reverted by reverting the relevant commits and running the inverse `UPDATE`. The resolver refactor reverts cleanly because the generic renderer is preserved at `/view` — restoring the old route just means changing the resolver back to render directly.

## Open Questions

- **Should the resolver pre-warm the destination route's data?** Current design uses `ensureQueryData(unitQueries.detail)` which warms the unit query but not the typed-page query (e.g., `bookQueries.detail` for a book unit). A second `ensureQueryData` call for the destination would speed up the redirect target's first paint at the cost of complicating the loader. Decide during implementation review based on perceived latency.
- **Does `/unit/:unitId/view` need its own canonical URL for SEO?** If a unit type with no typed page is publicly indexed, it lives at `/view`. May want a `<link rel="canonical">` pointing at `/unit/:id` so search engines treat the resolver as the canonical entry point. Defer until SEO concerns surface for any unit type that lacks a typed page.
- **Editor UX: should pasting a `unit` URL show the auto-extract as a banner ("Linked to: Chapter 3") or silently switch modes?** Banner is more transparent; silent is more frictionless. Lean banner — once — then collapse on subsequent edits. Confirm during implementation.
