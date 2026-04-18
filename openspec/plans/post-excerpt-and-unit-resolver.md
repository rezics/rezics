# Post Excerpt Rename & Unit Resolver — Design Plan

**Status**: Draft plan, pre-proposal
**Date**: 2026-04-17
**Scope**: Rename `PostKind.QUOTE` to `EXCERPT`, tighten the post-list contract type, add typed source metadata to excerpt posts, and refactor `/unit/:unitId` into an auto-redirecting resolver with `/unit/:unitId/view` as a generic fallback renderer.

---

## 1. Context & Motivation

Two symptoms surfaced the underlying problems:

1. **Runtime failures on book review / remark previews.** `prisma.post.findMany(...)` rejects with "Invalid value for argument `kind`. Expected PostKind." because the frontend sends lowercase values (`"review"`, `"remark"`) while the Prisma enum is uppercase (`REVIEW`, `REMARK`).
2. **Semantic mismatch on `QUOTE`.** The term "quote" foregrounds attribution to a speaker. In this library, users highlight memorable passages from books *and* game dialogue — the work and its author are already linked via `targetUnitId`, and the point of the post is the fragment itself, not the act of citing someone. "Excerpt" (摘錄 / 抜粋) fits better, and the codebase already half-admits this through hybrid names like `QuoteExcerptList`, `QuoteExcerptPreview`, `SingleQuoteExcerpt`.

The first symptom is a trivial fix at three call sites, but the root cause is a loose contract (`kind: t.Optional(t.String())`) that lets lowercase values pass type checking. Fixing the type ripples into tightening the backend cast and, once we are touching the post-kind surface, makes this a natural moment to commit to the `EXCERPT` rename and attach proper source metadata.

Separately, `/unit/:unitId` currently renders a generic page but is not a discovery primitive. Once excerpts can cite a unit by id, we want that id to resolve cleanly to whatever typed page the unit belongs on — book, chapter, shelf, review, etc. — without the excerpt author having to know the unit's type at post-write time.

No backwards compatibility is required. Existing `QUOTE` rows may be migrated in-place.

---

## 2. Goals

- Fix the `kind` runtime failure at its root (loose contract type + unsafe backend cast).
- Rename `QUOTE` → `EXCERPT` across the entire stack (enum, contract, routes, components, directories, i18n, seed data, `buildUrl`, Meili).
- Give excerpt posts a typed `source` field that supports both internal (unit-id) and rezics-domain URL references.
- Turn `/unit/:unitId` into a loader-driven redirect that uses `buildUrl` as the single source of truth, and move the current generic renderer to `/unit/:unitId/view`.
- Ship this as **one** OpenSpec change, since the four pieces share call sites and review surfaces.

---

## 3. Non-Goals

- No external-URL (non-rezics-domain) support for excerpt sources. The validator allows only `rezics.com` and its subdomains.
- No redirect preservation from `/quote/...` to `/excerpt/...`. The rename is clean; no 301s, no route aliases.
- No history/version tracking for excerpt sources. A source reference is updated in-place like any other post field.
- No discriminated `postExtraSchema` per kind. The shared `extra` object grows one optional `source` field; type-enforcing "only EXCERPT has source" is deferred.
- No data migration beyond the `QUOTE` → `EXCERPT` enum rename. Existing posts without `extra.source` simply render without a source link.

---

## 4. Design

### 4.1 Contract Type Tightening

The list-query schema becomes strictly typed on `kind`:

```ts
// package/contract/src/post.ts
export const postListQuerySchema = t.Object({
  // ...
  kind: t.Optional(postKindLiterals),   // was: t.Optional(t.String())
  // ...
});
```

`postKindLiterals` already exists and is used by `createPostSchema.kind`. `PostFilters` in `@rezics/api` inherits the narrowed type automatically via `Partial<PostListQuery>`.

The backend can drop its unsafe cast:

```ts
// package/server/src/post/post.service.ts:35
if (query.kind) where.kind = query.kind;    // no `as PostKind`
```

TypeScript then flags the three lowercase frontend call sites:

- `package/app/src/book-library/page/BookReviewPage.tsx:34` — `"review"` → `PostKind.REVIEW`
- `package/app/src/book-library/component/BookReviewsPreview.tsx:34` — `'review'` → `PostKind.REVIEW`
- `package/app/src/book-library/component/RemarkPreview.tsx:21` — `'remark'` → `PostKind.REMARK`

### 4.2 `QUOTE` → `EXCERPT` Rename

Every surface that references `QUOTE` migrates:

| Surface                            | Before                                 | After                                    |
|------------------------------------|----------------------------------------|------------------------------------------|
| Prisma enum                        | `PostKind.QUOTE`                       | `PostKind.EXCERPT`                       |
| Contract const + type union        | `PostKind.QUOTE`, `'QUOTE'`            | `PostKind.EXCERPT`, `'EXCERPT'`          |
| Route tree                         | `/quote/$unitId`, `/quote/book/$id`    | `/excerpt/$unitId`, `/excerpt/book/$id`  |
| App directory                      | `package/app/src/quote/`               | `package/app/src/excerpt/`               |
| Components                         | `QuoteCard`, `QuotePage`, etc.         | `ExcerptCard`, `ExcerptPage`, etc.       |
| Hybrid components                  | `QuoteExcerptList`, `…Preview`, `SingleQuoteExcerpt` | `ExcerptList`, `ExcerptPreview`, `SingleExcerpt` |
| i18n keys                          | `quote.*`                              | `excerpt.*`                              |
| `buildUrl`                         | case `'QUOTE'` → `/quote/:id`          | case `'EXCERPT'` → `/excerpt/:id`        |
| Meili post index filter            | `kind = 'QUOTE'`                       | `kind = 'EXCERPT'`                       |
| Seed / mock data                   | `mockQuotes.ts`, `kind: 'QUOTE'`       | `mockExcerpts.ts`, `kind: 'EXCERPT'`     |
| DB rows                            | `UPDATE Post SET kind = 'EXCERPT' WHERE kind = 'QUOTE'` (one-shot Prisma migration) | — |

The hybrid `QuoteExcerpt*` names collapse to plain `Excerpt*` once we commit — they were a sign that the underlying name was wrong.

### 4.3 Excerpt Source Metadata

`postExtraSchema` grows an optional `source` field (EXCERPT-specific by convention; other kinds ignore it):

```ts
// package/contract/src/post.ts
export const excerptSourceSchema = t.Union([
  t.Object({
    mode:   t.Literal('unit'),
    unitId: t.String(),
    title:  t.String({ minLength: 1, maxLength: 200 }),
  }),
  t.Object({
    mode:  t.Literal('url'),
    url:   t.String({ maxLength: 2048 }),     // scheme-less; runtime validator enforces rezics domain
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

**Field semantics:**

- `title` is a free-form human-written citation, *not* a snapshot of the linked unit's title. Example: `《指環王》第三章，第一節`. The author writes whatever describes the fragment's location in its source.
- `unit` mode stores only a unitId. Rendering emits `<a href="/unit/:unitId">`, which the resolver follows to the current typed page. This is the **stable** reference — survives unit renames, route changes, and typed-page restructures.
- `url` mode stores a scheme-less rezics-domain URL (e.g., `rezics.com/essay/foo`, `book.rezics.com/shelf/bar?tab=reviews#top`, `about.rezics.com/team`). This is the **frozen** reference — what the author pasted, preserved verbatim modulo scheme stripping.

**URL storage & validation:**

URLs are stored *without* `http://` or `https://`. Display prepends `https://` at render time:

```tsx
<a href={`https://${source.url}`} target="_blank" rel="noopener">{source.title}</a>
```

Validator lives in `@rezics/contract` (new `util/rezicsUrl.ts`, re-exported) so both frontend and backend share one implementation:

```ts
export function isRezicsUrl(raw: string): boolean {
  if (/^[a-z]+:\/\//i.test(raw)) return false;             // reject explicit scheme in storage
  let u: URL;
  try { u = new URL(`https://${raw}`); } catch { return false; }
  const host = u.hostname.toLowerCase();
  return host === 'rezics.com' || host.endsWith('.rezics.com');
}

export function normalizeRezicsUrl(raw: string): string | null {
  const stripped = raw.trim().replace(/^https?:\/\//i, '');
  return isRezicsUrl(stripped) ? stripped : null;
}
```

The exact-match-or-dot-prefix pattern rejects `rezics.com.attacker.com` while accepting `rezics.com`, `www.rezics.com`, `about.rezics.com`, `book.rezics.com`, and any future subdomain. `www.` is preserved, not stripped — `www.rezics.com` and `rezics.com` are stored as the author entered them.

Input UX is lenient: if the user pastes `https://rezics.com/foo`, the form strips the scheme before validation and storage. No "please remove https://" error messages.

No `localhost` bypass. Dev and prod share the same rule.

### 4.4 Unit Resolver Refactor

Current `/unit/:unitId` renders a generic page. That role splits into two routes.

```
/unit/:unitId                    # resolver — never renders, always redirects or 404s
/unit/:unitId/view               # generic renderer — absorbs the current behavior
```

**Resolver loader:**

```tsx
loader: async ({ params, context }) => {
  const unit = await context.queryClient.ensureQueryData(
    unitQueries.detail(params.unitId),
  );
  if (!unit) throw notFound();

  // buildUrl is the single source of truth for type → route mapping.
  const dest = buildUrl(unit);
  if (dest) throw redirect({ to: dest.path, params: dest.params });

  // Fallback for unit types that have no typed page yet.
  throw redirect({
    to: '/unit/$unitId/view',
    params: { unitId: params.unitId },
  });
}
```

**Properties:**

- **Single source of truth.** `buildUrl` already maps unit type + post kind → route. Any future mapping (new Unit type, new PostKind) is added there once; the resolver inherits it.
- **Late binding.** Excerpt sources in `unit` mode store only the id. The resolver runs fresh on every click — unit renames, route restructures, and type changes resolve correctly without touching the stored source.
- **Escape hatch.** Any unit type lacking a typed page falls through to `/view`, the generic renderer. No dead ends.
- **Prefetch.** `ensureQueryData` warms the cache so the target page mounts with data already available.

**Status & visibility behavior** (to confirm with the user before drafting specs):

Probable rule: mirror whatever the typed pages already do. DELETED → 404. DRAFT / PRIVATE / UNLISTED → 404 for non-owner, redirect for owner. A single `canAccessUnit(unit, viewer)` helper used by both the resolver and typed pages keeps this consistent.

**Redirect-loop safety:**

If any typed page ever redirects back to `/unit/:id`, the chain loops. A single assertion test — "for every unit type, resolving from `/unit/:id` terminates in one redirect" — is sufficient to block regressions.

---

## 5. Scope of the Change

One OpenSpec change rolls up all four pieces:

1. **Contract tightening.** `postListQuerySchema.kind` narrowed, backend cast dropped, three frontend call sites fixed.
2. **`QUOTE` → `EXCERPT` rename.** Enum, contract, routes, components, directory, i18n, seed, `buildUrl`, Meili, one-shot DB migration.
3. **Excerpt source.** `excerptSourceSchema` discriminated union, `rezicsUrl` validator helper, form UI for picking unit-mode vs url-mode, render-time `https://` prepending, author-written `title`.
4. **Unit resolver.** `/unit/:unitId` becomes loader-driven redirect via `buildUrl`; `/unit/:unitId/view` absorbs the current generic renderer; status/visibility rules mirror typed pages.

Specs touched or added:

- `post-kind-contract` — update `kind` typing requirement, remove COMMENT residue if still present.
- `type-extension-post` — rename QUOTE to EXCERPT, add source metadata requirement.
- `composed-editors` — excerpt editor form (unit picker vs url input).
- New capability: `unit-resolver` — describes the `/unit/:unitId` redirect behavior and `/view` fallback.

---

## 6. Risks & Open Questions

- **Resolver behavior for DELETED / DRAFT / PRIVATE units.** Default to 404 for non-owner? Redirect to `/view` for owner? Uniform 404 regardless of ownership? Pending confirmation; will be pinned down in the spec before the proposal is drafted.
- **`source.title` drift.** The title is a snapshot. If the author later edits the source unit's name or the unit's meaning shifts, the excerpt's `title` keeps saying what it said. Accepted as intentional — the author wrote that citation at that moment.
- **`source.url` staleness.** If a rezics page moves or is deleted, the stored URL dead-ends. No cascade, no repair — same behavior as any external link.
- **Scope creep resistance.** The four pieces are tightly coupled via shared call sites and shared intent, which is why they ship together. But they have different review burdens — the type tightening is mechanical, the resolver refactor is architectural. The proposal should break tasks along these lines so partial review is still possible.
- **`postExtraSchema` shape.** Keeping `source` on the shared `extra` means other kinds *could* set it. If that becomes a problem, a follow-up change can discriminate `postExtraSchema` by kind. Not blocking.
