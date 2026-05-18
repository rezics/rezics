## Context

Rezics models first-class content through `Unit`. `Unit` already carries `status`, `visibility`, `rating`, ownership, translations, realm membership, tags, and type extensions such as Book, Post, Shelf, and Realm. Some domains already enforce parts of a publication policy:

- Posts soft-delete by setting `Unit.status = DELETED` and clearing `Post.body`.
- Public content search generally indexes only `PUBLISHED + PUBLIC` content.
- System shelves are created as `PRIVATE`.
- Book/Game/Media use `isLicensed` as a separate licensed-work search flag.

The missing piece is a shared contract. Public APIs, Meilisearch sync, shelf previews, post detail reads, and composer defaults do not all apply the same rules. This design makes Unit publication policy explicit while keeping the first implementation narrow enough to avoid post-tree permission complexity.

## Goals / Non-Goals

**Goals:**

- Add a stable license registry and a single effective Unit license slug.
- Resolve default license choices from platform, user, realm, and composer input.
- Keep `isLicensed` distinct from publishing license metadata.
- Make deleted posts soft-delete consistently across list, detail, tree, reference, and search surfaces.
- Ensure public shelf discovery excludes private/system shelves and only returns shelves containing the requested target.
- Preserve public search eligibility as `PUBLISHED + PUBLIC`.

**Non-Goals:**

- No arbitrary multi-license arrays on a single Unit.
- No custom license slug authoring in v1.
- No `kind=POST` visibility picker.
- No mixed-visibility post trees.
- No restore/trash UI.
- No moderation workflow or legal audit workflow.

## Decisions

### D1. Store one effective license slug on Unit

Add Unit-owned publication metadata with:

- `licenseSlug: string | null`

License display text is not stored on Unit rows. The contract registry maps each
accepted slug to a stable i18n key, and UI surfaces render that key through the
active locale.

The initial accepted license slugs are:

- `all-rights-reserved`
- `cc0-1.0`
- `cc-by-4.0`
- `cc-by-sa-4.0`
- `cc-by-nc-4.0`
- `cc-by-nc-sa-4.0`

The contract package owns the registry and validation schema. The database stores a string instead of a Prisma enum.

Alternatives considered:

- Prisma enum: rejected because license catalogs are product/legal configuration and should not require schema migrations for every new public license.
- `licenseSlug[]`: rejected for v1 because arrays blur whether multiple licenses are alternatives, cumulative obligations, or component-specific notices.
- Free-form Unit-owned license text: rejected because it can conflict with the selected slug, bypass fixed license semantics, and break i18n.
- Store only in `Unit.extra`: rejected because search, validation, and API contracts need stable fields.

### D2. Use inheritance only for composer defaults

Default license resolution is advisory:

1. Platform default.
2. User publishing preference.
3. Realm publishing preference for the active composer realm.
4. Explicit composer selection.

The selected value is stored on the created Unit. Realm preference overrides user preference only as prefilled UI state. It is not a permanent dynamic inheritance link and does not force later edits.

If a composer targets multiple realms, the primary composer realm supplies the default. If no primary realm exists, use the user or platform default.

Alternatives considered:

- Dynamic runtime inheritance: rejected because changing realm/user defaults would unexpectedly mutate old content semantics.
- Realm-enforced license policy: out of scope; it belongs to moderation/rule enforcement, not this publication default change.

### D3. Keep `isLicensed` separate

`isLicensed` on Book/Game/Media means "this work has licensing/rights clearance" for catalog and search filtering. It does not describe the license under which the user publishes a Unit on Rezics.

Publishing license fields must not replace or reinterpret existing `isLicensed` filters.

### D4. Use `UnitStatus.DELETED` as post tombstone state

Post hard delete remains disallowed for normal user deletion. Deleting a post marks the backing Unit as `DELETED` and removes sensitive body content.

Read behavior:

- Public lists exclude deleted posts.
- Public search excludes deleted posts.
- Direct public detail reads return not found/gone unless a dedicated tombstone detail shape is requested by a tree/reference path.
- Tree/reference contexts may return a tombstone DTO with id, kind, depth, parent/root linkage, counters needed for layout, and no body.
- Author/admin reads may see status metadata, but cleared body content is not restored.

Alternatives considered:

- Cascade hard-delete post trees: rejected because it breaks references, notifications, reply layout, and auditability.
- Always return deleted details as normal DTOs: rejected because it makes deleted content look available and leaks too much state.

### D5. Do not expose visibility controls for `kind=POST`

This change does not add visibility selection for generic `kind=POST`.

Review-like or work-attached post kinds can receive visibility support only where the caller can honor it consistently. For v1, any post visibility support must be root-level and tree-wide; replies inherit the root and cannot become more public or more private than their root.

Alternatives considered:

- Full per-node post visibility: rejected because it complicates reply counts, thread holes, notification access, references, and Meilisearch eligibility.
- No post visibility at all: acceptable fallback, but root-level support for review-like content remains useful if implementation cost stays small.

### D6. Centralize public eligibility helpers

Server and search sync code should share equivalent eligibility predicates:

- public Unit content: `status = PUBLISHED` and `visibility = PUBLIC`
- public post search: backing Unit is `PUBLISHED + PUBLIC` and post is not locked for public search
- public shelf discovery: shelf Unit is `PUBLISHED + PUBLIC`

The helpers may live per package, but behavior must be mirrored by tests across server and search packages.

### D7. Shelf public discovery is not collection state

System shelves such as Favorites are private collection state. Public book shelf previews and `/shelf/book/:bookId` discovery must:

- send `containsUnitId`
- filter by target membership
- include only published public shelves for public callers
- exclude private system shelves unless the caller is the owner/admin and explicitly asks for owner-scoped shelves

The current `containsItemRef` usage is treated as a bug and replaced with `containsUnitId`.

## Data Flow

```text
composer context
  user settings
  active realm defaults
        |
        v
resolved default license
        |
        v
create/update API validates licenseSlug
        |
        v
Unit publication metadata
        |
        +--> DTO/detail/list display
        +--> Meilisearch document, only if public eligible
```

```text
post delete
  |
  v
Unit.status = DELETED
Post.body = null
  |
  +--> public list/search: excluded
  +--> tree/reference: tombstone if needed
  +--> Meili sync: delete document
```

## Risks / Trade-offs

- License semantics may be mistaken for legal advice -> UI copy must describe labels plainly and avoid legal guarantees.
- String-backed license slugs can drift -> contract registry validation and tests must be the only accepted input path.
- Partial Meilisearch updates can upsert ineligible documents -> membership/tag/realm partial sync paths must check eligibility or call full single-unit sync when eligibility may matter.
- Tombstone DTOs can leak metadata -> tombstones must omit body, title-like extra fields, and author-private data unless explicitly accepted by the spec.
- Owner/admin visibility exceptions can diverge across endpoints -> public and owner-scoped query modes must be explicit in API tests.

## Rollout Plan

1. Add contract schemas for license registry, Unit publication fields, and optional user/realm defaults.
2. Add database migration for Unit publication metadata and backfill existing publishable Units to `all-rights-reserved` when a value is required by API output.
3. Update server DTO mappers and create/update paths for supported Unit types.
4. Add shared eligibility helpers and apply them to post, shelf, content sync, and search paths.
5. Fix shelf book preview query parameter usage and add regression tests.
6. Add deleted-post tombstone behavior and tests for lists, direct details, threaded reads, and Meili removal.
7. Run type checks and targeted tests.
8. Rebuild or clean affected Meilisearch indexes after deployment.

Rollback: schema additions are backward-compatible if nullable. API behavior changes are stricter public filtering; rollback can restore previous filters while leaving new columns unused. Search cleanup can be repeated idempotently.

## Open Questions

- Should review-like post visibility support ship in the same implementation, or should this change only define the guardrails and leave actual UI controls out?
- Should `cc-by-nd-4.0` be included in the initial registry, or deferred until the product has clearer derivative-work policy copy?
