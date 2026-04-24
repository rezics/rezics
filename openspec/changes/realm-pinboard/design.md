## Context

Today, the homepage announcement bar and notice board are powered by a single `EchoKV` row (`home_notice`) that stores a JSON array of `{ id, title, content, tag, date, pin? }`. This was cheap to ship but has aged poorly:

- `title` / `content` are single strings — no way to serve `zh-Hans` and `en` users the right text.
- No author attribution, no audit log, no soft-delete, no publish lifecycle.
- No generic "curated list" primitive usable by non-default realms.

Meanwhile, the content graph already has everything required to model first-class multilingual posts: `Unit` + `Post` + `UnitTranslation` (title/subtitle/summary/description per language) + `TranslationGroup` (parallel-translation siblings for body-level content). Realms already carry an untyped `extra: Json?` column. We do not need new tables.

Two product needs share one underlying shape:

1. **Global announcements** — an ordered list of multilingual posts shown on the homepage.
2. **Realm feed pinning** — an ordered list of posts shown at the top of any realm's feed.

Both are "named, ordered lists of `Post` unit-ids attached to a realm, with i18n-aware reads and writes". We therefore introduce a single generic capability — **pinboard** — keyed by a whitelisted `pinboardKey` (`"announcement"` | `"pinned"`). The global homepage is just `default-realm`'s `announcement` pinboard.

## Goals / Non-Goals

**Goals:**

- Replace `home_notice` with a typed, i18n-aware content surface backed by real `Post` units.
- Provide a single backend capability that serves both global announcements and per-realm pinning without duplication.
- Give mods/admins a polished admin UX for creating, editing, pinning, reordering, and soft-deleting pinboard entries, with drag-and-drop, unsaved-change guards, and proper loading/empty/error states.
- Keep persistence entirely on existing tables (`Realm.extra` + `Post` + `Unit` + `UnitTranslation` + `TranslationGroup`) — no schema migration.
- Tolerate stale pin ids (missing / soft-deleted posts) at read time without admin intervention, and expose a cleanup affordance to mods.
- Reach language-resolved reads with sensible fallback (requested → realm default → `en` → first available).

**Non-Goals:**

- **Not** introducing a new `PostKind` (e.g. `ANNOUNCEMENT`). Announcement-ness is "this post id appears in `default-realm.extra.announcementPostIds`", nothing more.
- **Not** introducing subtype categorization on first release. The existing `公告 / 活动 / 更新` tag chip is dropped; tag-based categorization may return later through the generic tag system.
- **Not** implementing `filterTagIds` writes. The field is reserved in the typed `Realm.extra` shape so future work can add it without another contract break, but no endpoints manipulate it here.
- **Not** replacing other EchoKV usage. `home_carousel` and admin tooling keep their rows.
- **Not** pushing pinboard content through `translationService` / `postService` / `translationGroupService` at the public API level — those services already span their own transactions, and nesting would invite deadlocks. Pinboard composes them at the Prisma tx level directly.
- **Not** shipping optimistic concurrency control in this change. We use `SELECT ... FOR UPDATE` row locking on `Realm` during reorder/pin/unpin, and leave a TODO marker for future version-based OCC.

## Decisions

### D1. Generic `pinboard` capability with a whitelisted `pinboardKey`

**Decision:** one feature folder, one service, one set of endpoints, one query hook family — parameterized by `pinboardKey: "announcement" | "pinned"`. The persisted slot is `Realm.extra.<pinboardKey>PostIds: string[]`.

**Why over alternatives:**

- Two separate features (`announcement`, `pinned`) would duplicate i18n plumbing, admin UX, and permission code.
- A fully open string key would force every downstream reader to validate the key — a tiny static whitelist is clearer and future-proof enough.
- The name **`pinboard`** is neutral: it describes the primitive ("named ordered list of pinned posts") without implying a specific product use.

**Add a new key** = extend the literal union + add a new field to `Realm.extra` typing + add a mount point in the UI. No schema migration.

### D2. Dual-track i18n: UnitTranslation for list, TranslationGroup for detail

**Decision:** A pinboard row renders list-level text (`title`, `summary`) by resolving a `UnitTranslation` row for the viewer's language. The detail route resolves a **sibling** `Post` via `TranslationGroup.supportedLanguages` + the viewer's language, then renders that sibling's `Post.body`.

- List views never touch `Post.body` — they read `UnitTranslation.{title, summary}`.
- Detail views use `translationGroupService.listGroupSiblings(unitId)` to enumerate sibling unit ids, resolve the best language, and render the matching sibling's body.
- If a post has no `TranslationGroup` (standalone), the detail view renders the queried post's own body.

**Why:** this matches the existing content model exactly. `UnitTranslation` is the existing mechanism for "a different title/summary per language for the same unit"; `TranslationGroup` is the existing mechanism for "this post has parallel-translation siblings with their own bodies". Pinboard does not invent a new language mechanism.

**Alternatives rejected:**

- Embedding all languages in `Realm.extra` JSON — kills queryability, duplicates the existing i18n system, and makes moderation impossible.
- Forcing every pinboard post into a TranslationGroup, even for single-language entries — needless ceremony for the common case.

### D3. Composite create/update/delete; Prisma-level transactions; atomic pin/unpin/reorder

**Decision:** the pinboard service exposes two transactional groups of operations.

**Content lifecycle (composite writes):**

- `createPinboardEntry(realmId, pinboardKey, input)` — in one `prisma.$transaction`:
  1. Create a `Unit` (type=POST, defaultLanguage=input.defaultLanguage, status=PUBLISHED).
  2. Create the `Post` with `realmUnitId = realm.unit.id`, `authorUserId = actor`, `body = input.translations[defaultLanguage].body`.
  3. Insert one `UnitTranslation` per entry in `input.translations` (`title`, `summary`, `description?`).
  4. If `input.translations` has more than one language: create a `TranslationGroup(supportedLanguages = keys)`, point the root unit's `translationGroupId` at it, and create one sibling `Unit(+Post+UnitTranslation)` per non-default language. Each sibling's `Post.body` is taken from the corresponding translation entry.
  5. Append the root unit id to `Realm.extra.<pinboardKey>PostIds`, taking a `SELECT ... FOR UPDATE` on the realm row first.
- `updatePinboardEntry(realmId, pinboardKey, unitId, input)` — upsert `UnitTranslation` rows for affected languages (authoritative for title/summary/description), update sibling `Post.body` where the translation supplies it. Keep `TranslationGroup.supportedLanguages` consistent with the languages actually present across siblings.
- `deletePinboardEntry(realmId, pinboardKey, unitId)` — soft-delete (`Unit.deletedAt = now()`) the root unit **and** its siblings, then remove the id from `Realm.extra.<pinboardKey>PostIds` in the same tx.

**List ops (id-only, cheap):**

- `pinToPinboard(realmId, pinboardKey, unitId, position?)` — append or insert an existing post id.
- `unpinFromPinboard(realmId, pinboardKey, unitId)` — remove the id from the list (**does not** soft-delete the post; distinct from `deletePinboardEntry`).
- `reorderPinboard(realmId, pinboardKey, orderedUnitIds)` — replace the array; validate it is a permutation of the current array (same set) to reject concurrent insert/delete races.

All list ops take `SELECT ... FOR UPDATE` on the `Realm` row at the top of the transaction, then read/modify/write `extra`. This is good enough correctness for the expected write rate (a handful of writes per realm per day). A TODO is left in code for version-based OCC.

**Why:** composite writes are kept off the public `TranslationService` / `TranslationGroupService` / `PostService` APIs to avoid nested transactions through service boundaries; those services already open `$transaction` blocks internally and are not safe to compose. Pinboard uses Prisma directly within its own `tx` and only calls helpers that accept a `tx` parameter (e.g. `translationGroupService.onUnitDeleted(tx, ...)`).

### D4. Read-time tolerance + moderator cleanup UI

**Decision:** list reads take `Realm.extra.<pinboardKey>PostIds` as a soft hint. The service:

1. Loads all referenced units in one query, filters out `deletedAt != null` and missing ids, preserving the input order.
2. Returns only the live set to callers. Public callers never see stale ids.
3. In admin mode (moderator+), additionally returns a `staleIds: string[]` list so the admin UI can show "3 broken references — clean up".

**Why:** this lets us avoid expensive write-time cleanup on every post delete, tolerates races, and gives mods a clear affordance to tidy up.

### D5. Permissions: reuse existing realm roles + global admin bypass

**Decision:** all write endpoints require one of:

- realm owner or `moderator` role in the target realm (`RealmMember`).
- global `admin` or `root` user, regardless of membership.

Global admin / root can manage `default-realm`'s `announcement` pinboard without being a member (they already are the owner of `default-realm` per the seed, but we rely on the role check rather than that fact).

Reads are public subject to the realm's existing visibility rules (public realm → anyone; private → members + admins).

**Why:** this mirrors existing `realm-manage` permissions exactly and avoids a bespoke permission surface.

### D6. Typing `Realm.extra` in the contract

**Decision:** in `@rezics/contract`, replace `realmDTOSchema.extra`'s `t.Any()` with:

```ts
const realmExtraSchema = t.Optional(t.Nullable(t.Object({
  announcementPostIds: t.Optional(t.Array(t.String())),
  pinnedPostIds:       t.Optional(t.Array(t.String())),
  filterTagIds:        t.Optional(t.Array(t.String())),
})));
```

And remove `Realm.extra` from `typed-json-fields`'s "known untyped" list.

**Why:** this is the only place in the realm payload previously typed as `t.Any()`. Typing it now lets every frontend consumer (especially pinboard hooks) stop casting.

`filterTagIds` is shaped but not written. Future feed-filter changes can turn on writes without another contract migration.

### D7. Default-realm is the canonical global announcement home

**Decision:** the homepage reads `getPinboard({ realmSlug: "rezics", pinboardKey: "announcement", language: currentLanguage })`. The realm's manage page (`/realm/rezics/manage`) is the canonical admin entry point. Other realms' manage pages only show the `pinned` tab; `default-realm` additionally shows the `announcement` tab.

**Why:** keeps the "who owns this announcement?" question singular. Avoids inventing a special-case global endpoint.

### D8. Drop the 3-way tag chip (公告 / 活动 / 更新)

**Decision:** first release of pinboard has no per-entry subtype. `AnnouncementBar` and `NoticeBoard` render title/summary/date/pin-badge without a tag chip.

**Why:** the old chips were encoded as free-form strings inside the EchoKV blob and have no counterpart in the content graph. Shipping subtype tagging now would force a category design discussion that is orthogonal to i18n. When the general tag system matures, we can layer subtype tags on top without touching pinboard.

## Risks / Trade-offs

- **Stale pin references on delete** → read-time filter drops them silently; admin cleanup UI surfaces them. Acceptable: list writes are rare, and "just delete the post" is the most common case we want to support.
- **Concurrent mod edits to the same pinboard** → `SELECT ... FOR UPDATE` on the realm row serializes writes. Theoretical lost-update window during composite content edits is tolerated; TODO left for OCC with a `version: Int` on `Realm.extra` or a parallel `version` column.
- **No migration, but the homepage source silently changes** → deploy order matters: contract + server must ship first, then frontend. Between those, the homepage can show an empty announcement bar momentarily. Acceptable and visible.
- **Seed data** → a fresh DB with no announcements would render an empty bar. We ship a seed that creates 2–3 sample multilingual announcements in `default-realm` so `bun run prisma:migrate` + seed produces a non-empty homepage out of the box.
- **`Realm.extra` typed now, existing rows have unknown JSON** → we treat the DTO shape as optional-everything-optional, so legacy JSON keys are ignored but not dropped. Existing un-pinned realms will read their extra as `{}` or their existing content untouched.
- **Admin UX scope is wide** → loading / empty / error / unsaved-change / optimistic-rollback / a11y / dnd are all required for first merge. This is stated up-front in the proposal's quality bar section; tasks.md decomposes each.
- **Composite tx size** → creating a 5-language announcement produces ~1 Unit + 5 UnitTranslation + 5 sibling Unit+Post + 1 TranslationGroup update + 1 Realm update in one tx. Well within Postgres limits; flagged for monitoring.

## Open Questions

None that block implementation. The two items deliberately left for later:

- Optimistic concurrency control (versioned `Realm.extra` writes) — a TODO marker is sufficient for first release.
- Subtype tagging on announcements — deferred to the general tag system.
