## Why

Posts (and other Unit types) currently have only one i18n strategy available: `TranslationGroup`, where each language version is an independent parallel sibling Unit. This fits **wiki-style content** (different authors, independently authored, equally authoritative), but is awkward for **single-conceptual-entry content with language versions** — announcements, pinned posts, official notices — where readers should see one entry, with a curated language version.

The Work-Release pattern already implements exactly that semantic for `BOOK` / `GAME` / `MEDIA`: a Work is the abstract "thing", Releases are versions of that thing, `UnitTranslation` on the Work caches list metadata, and `UnitTranslation.sourceReleaseUnitId` points to the canonical Release per language. The current `work-release` capability explicitly **excludes POST**, leaving Posts to use the misfit `TranslationGroup` model for announcement/pinboard use cases.

The recently-built `realm-pinboard` change papered over this mismatch by combining `TranslationGroup` (for body siblings) with `UnitTranslation` (for list metadata), producing a special-purpose `pinboard` backend that duplicates Work-Release semantics imperfectly. The cleaner path: extend Work-Release to POST, let pinboard/announcement compose over generic Unit primitives, and keep `TranslationGroup` exclusively for true wiki cases.

Cross-user Work-Release linkage also needs a permissioned approval flow. A user authoring a translation cannot unilaterally claim "my translation is a Release of someone else's Work" without that Work owner's consent (except for wiki-mode types where contributions are encouraged). The existing system has no formal authority abstraction.

## What Changes

- Extend the **Work-Release pattern to `POST`** (and any future Unit type), removing the current restriction to `BOOK` / `GAME` / `MEDIA`. Work-Release becomes the canonical i18n primitive for "single entry, multiple language versions" content.
- Introduce a formal **`hasAuthorityOver(caller, unit)`** authorization helper at the unit-domain service layer. Authority sources: unit owner (`unit.userId`), system admin role, or realm moderator role for a realm containing the unit. Several existing endpoints can later migrate to this helper; for this change, scope is the new Work-Release endpoints.
- Add **`PATCH /units/:id/work-link`** primitive on the `unit` domain that sets / clears `Unit.workUnitId`. Authorization requires `hasAuthorityOver(caller, releaseUnit)` on the release-side. Work-side authorization is granted by either (a) `hasAuthorityOver(caller, workUnit)`, (b) `workUnit.type ∈ WIKI_TYPES`, or (c) a pending `WorkLinkClaim` resolved by an authorized work-side approver.
- Add **`WorkLinkClaim`** entity (new Prisma model + REST endpoints) for pending cross-user linkage requests. Status enum: `PENDING` / `APPROVED` / `REJECTED` / `WITHDRAWN`. Endpoints under `/work-link-claims` for create / approve / reject / withdraw / list-by-work.
- Define **`WIKI_TYPES`** constant in `@rezics/contract` (initial set: `BOOK`, `GAME`, `MEDIA`) that short-circuits work-side approval for contribution-friendly types. `POST` is **not** in `WIKI_TYPES`.
- Add **`PATCH /units/:workId/translations/:lang/source`** primitive to set `UnitTranslation.sourceReleaseUnitId`. Frontend writes derived `title` / `summary` in the same call (auto-derive logic lives in the editor, not the backend).
- Define **`RealmExtra`** typed contract in `@rezics/contract`: `{ pinboard?: string[]; announcement?: string[] }`. Both keys hold ordered Unit ID lists. Realm.extra is otherwise treated as loose JSON ("trust" strategy: any key allowed; only these two are well-known with i18n hints).
- Add **i18n locale entries** under `realm.extra.announcement.*` / `realm.extra.pinboard.*` (name, description, usage warning) in all five locale files (`en`, `zh-hans`, `zh-hant`, `ja`, `de`). The English string is duplicated as a JSDoc comment on the contract field; convention keeps them in sync.
- Extract **`TranslationEditor` / `TranslationTabs` / `WorkReleaseNav`** from `package/app/src/i18n/components/` to **`@rezics/ui`**. `WorkReleaseNav` is decoupled from `bookQueries` and accepts a parameterized data source (releases prop or query function). Existing Book usages are updated to import from `@rezics/ui`.
- Extend **`@rezics/notify`** with a "system notification + email" delivery mode. WorkLinkClaim creation / status change emits notification + email to the work-side owner.
- **BREAKING**: Remove the pinboard backend feature: `package/server/src/pinboard/`, the contract module `package/contract/src/pinboard.ts`, and Elysia mount in `package/server/src/index.ts`.
- **BREAKING**: Rewrite `package/app/src/pinboard/` as a thin contract-driven editor that composes the generic primitives (Realm extra editor + Work-Release linkage + TranslationEditor). Existing pinboard data is dropped (no migration: per project guidance, no compatibility constraints).
- **BREAKING**: Supersedes the in-progress `realm-pinboard` change. That change should be withdrawn (not archived) before this one applies.
- Read-time stale-ID tolerance: Realm.extra unit-id lists are filtered at read time when underlying units are deleted / unauthorized. Admin views surface stale IDs for cleanup.

## Capabilities

### New Capabilities

- `unit-authority`: Formal authorization helper `hasAuthorityOver(caller, unit)` returning true for owner / admin / realm-mod, with corresponding scenarios.
- `work-link-claim`: Pending cross-user Work-Release linkage approval flow — entity, status lifecycle, REST endpoints, notification side-effect.
- `realm-extra-pinboard-keys`: Typed RealmExtra contract carrying `pinboard` / `announcement` ordered ID lists, with i18n usage notes and trust-based read/write semantics.
- `notify-system-email`: System notification with email delivery as a single fan-out from a notify call.

### Modified Capabilities

- `work-release`: Extend supported parent types from `{BOOK, GAME, MEDIA}` to `{BOOK, GAME, MEDIA, POST}`. Add the `WIKI_TYPES` short-circuit and `WorkLinkClaim` integration into the work-link operation. Promote `UnitTranslation.sourceReleaseUnitId` to a first-class curatorial pointer (the "current canonical Release per language" semantic) with explicit scenarios.
- `unit-translation`: Add the `sourceReleaseUnitId` curatorial-pointer requirement and frontend-driven derive semantics (title/summary derivation is allowed to drift from `Release.body`; clients write derived values explicitly).

## Impact

**Affected packages**:
- `package/server/prisma/schema.prisma` — add `WorkLinkClaim` model + status enum
- `package/server/src/unit/` — add `work-link` endpoint, `hasAuthorityOver` helper, claim endpoints
- `package/server/src/pinboard/` — **deleted**
- `package/server/src/index.ts` — remove pinboard mount, add work-link-claim mount
- `package/contract/src/unit/` — add work-link / claim / translation-source contracts
- `package/contract/src/pinboard.ts` — **deleted**
- `package/contract/src/realm/` — add `RealmExtra` typed contract
- `package/contract/src/index.ts` — export `WIKI_TYPES` constant
- `package/api/` — query/mutation hooks for new endpoints
- `package/ui/` — receive moved `TranslationEditor` / `TranslationTabs` / `WorkReleaseNav`
- `package/app/src/i18n/components/` — files moved out (or thin re-exports to ease migration)
- `package/app/src/pinboard/` — rewritten as thin contract-driven section
- `package/app/src/book-library/` and `package/app/src/book-edit/` — update imports for the moved UI components
- `package/app/src/locale/{en,zh-hans,zh-hant,ja,de}.ts` — add `realm.extra.{pinboard,announcement}.*` keys
- `package/notify/` — add system-notification-with-email capability
- `package/server/prisma/seed/mocks/pinboard.ts` — replace seed content to populate via new primitives

**Database**:
- New table `WorkLinkClaim` (Prisma migration)
- No data migration of existing pinboard rows (dropped per "no compatibility" guidance)

**Cross-cutting**:
- `realm-pinboard` change must be withdrawn before this change is applied.
- Convention enforcement (`bun run check:convention`) should not be affected; route conventions remain compliant.
- All new public link rendering continues to use `<SafeLink>` per `outbound-link-protection`.
