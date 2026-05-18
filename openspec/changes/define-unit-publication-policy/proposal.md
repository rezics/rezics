## Why

Unit-backed content currently has related but under-specified publication concepts: copyright/license defaults, soft deletion, `UnitVisibility`, and search/list exposure. The gaps now show up as user-facing inconsistencies, including deleted post handling, public shelf queries leaking private system shelves, and book review pages showing shelves that do not contain the target book.

## Problem

`UnitStatus.DELETED`, `UnitVisibility`, and licensing metadata are all platform-level concerns, but each domain currently interprets them independently. Posts soft-delete through `UnitStatus.DELETED`, content search generally indexes only public published units, and system shelves are private, but list/detail/search/reference behavior is not documented as a shared policy.

## Goals

- Define a shared Unit publication policy for status, visibility, and search/list exposure.
- Add a license registry and default-selection model for user and realm publishing flows.
- Keep post visibility intentionally narrow: do not support arbitrary `kind=POST` visibility controls in this change.
- Clarify deleted post behavior for lists, details, trees, references, counters, and Meilisearch.
- Fix shelf list semantics so public book shelf previews only show public published shelves containing the target unit.

## Non-goals

- No full legal rights management system.
- No multi-license array model for a single Unit.
- No custom user-defined license slugs in the first version.
- No mixed-visibility post trees where individual replies can be more private or more public than the root.
- No moderation workflow, restore workflow, or trash-management UI.
- No replacement of the existing `isLicensed` fields on Book/Game/Media; those remain distinct from publishing license metadata.

## What Changes

- Introduce a platform license registry with stable slugs such as `all-rights-reserved`, `cc0-1.0`, `cc-by-4.0`, `cc-by-sa-4.0`, `cc-by-nc-4.0`, and `cc-by-nc-sa-4.0`.
- Add a single effective license slug on Unit-backed publishable content, with optional copyright notice text.
- Define default license resolution as platform default, then user preference, then realm preference, then composer override. Realm defaults are advisory and override user defaults only as composer prefill, not as an immutable rule.
- Define `UnitStatus.DELETED` as the canonical soft-delete state for posts and post trees.
- Define public read behavior for deleted posts: ordinary lists and search exclude them; tree/reference contexts may return tombstone DTOs when needed to preserve structure.
- Keep `kind=POST` out of visibility controls for now. Review-like and work-attached post kinds may receive visibility support only where the UI and read paths can honor it consistently.
- Require search indices to contain only eligible public published documents for public search surfaces.
- Require shelf list and book-shelf preview queries to respect `status=PUBLISHED`, `visibility=PUBLIC`, and `containsUnitId` for public callers.

## Capabilities

### New Capabilities

- `unit-publication-policy`: Defines shared Unit publication behavior for license metadata, default license resolution, status, visibility, deletion, and public exposure.

### Modified Capabilities

- `type-extension-post`: Clarifies post soft deletion, post visibility scope, and tombstone behavior.
- `post-search-index`: Requires deleted and non-public posts to be removed from the Meilisearch post index.
- `type-extension-shelf`: Requires public shelf list/detail surfaces to filter out private/system shelves unless explicitly owner-authorized.
- `shelf-collection`: Clarifies that private system shelves such as Favorites are collection state, not public shelf discovery results.
- `content-sync`: Requires content-index sync and partial sync paths to preserve public eligibility rules for Unit-backed content.
- `content-search-api`: Requires public search filters to remain public-only and align with Unit publication eligibility.
- `settings-preferences`: Adds user publishing defaults for license selection.
- `default-realm-contract`: Adds optional realm publishing defaults for license selection.

## Scope

This change covers shared contract definitions, Prisma schema additions, server-side policy helpers, public API filtering, Meilisearch sync eligibility, and frontend composer defaults needed to make the policy visible and enforceable. It also covers the known book review shelf preview issue where the app sends the wrong shelf filter key and public shelf list reads do not filter private shelves.

## Impact

- Affected packages: `package/contract`, `package/server`, `package/search`, `package/api`, and `package/app`.
- API impact: post and Unit-derived DTOs may expose publication metadata; create/update inputs may accept license fields for publishable content. Shelf and post list responses become stricter for public callers.
- Database impact: add license metadata to Unit or an equivalent Unit-owned publication metadata structure; backfill existing content to the platform default where needed.
- Search impact: Meilisearch sync must delete or skip documents that are not `PUBLISHED + PUBLIC`, including partial sync paths.
- Backward compatibility: existing content without explicit license metadata is treated as `all-rights-reserved`. Existing `isLicensed` filters keep their current meaning.
- Migration needs: schema migration for license metadata, data backfill for existing Units, and a Meilisearch resync or targeted cleanup for documents that no longer qualify.
