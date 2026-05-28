# OpenSpec Specs Slimdown — Task List

**Status**: Execution checklist
**Date**: 2026-05-28
**Source**: `openspec-specs-slimdown-report.md`
**Workflow note**: These tasks are intentionally **outside** the OpenSpec
change/sync workflow. Each task edits `openspec/specs/` directly. Treat them
as editorial cleanup, not as behavior proposals.

---

## How to use this list

- Phases A → D are ordered by risk/effort. Don't start a later phase until
  earlier ones are stable.
- Each task is its own commit. Group like-shaped edits inside a phase if the
  diff stays reviewable.
- Before deleting any spec, grep its `### Requirement:` entries and confirm
  every requirement lives somewhere in the survivor.
- After each phase, rerun the methodology counts from `§7` of the report and
  update the "After phase X" totals at the bottom of this file.

---

## Phase A — Delete confirmed zombies

### A1. Delete self-declared retired specs

- [ ] `openspec/specs/auth-organization/` — file states "This capability has
      been retired."
- [ ] `openspec/specs/exchange-auto-provision/` — file states "This
      capability has been retired."

Verification: confirm nothing in `openspec/changes/` references these names
as an active dependency (historical references in archived changes are
fine).

### A2. Sweep phrase-match candidates

Read the Purpose of each of the following specs and decide whether the
capability is genuinely active or a leftover. Delete the retired ones; for
the rest, copy their actual status into the comment of this task so the next
reader can skip them.

- [ ] `development-stage-compatibility` — Purpose is about a rule, not a
      retirement; likely keep.
- [ ] `engagement-subscription`
- [ ] `attribution`
- [ ] `app-search-feature`
- [ ] `api-cache-coherence`
- [ ] `cross-site-auth-presence`
- [ ] `dispatch-token-session`
- [ ] `convention-enforcement`
- [ ] `auth-token-lifecycle-provider`
- [ ] `database-reset-preserve`
- [ ] `content-search-contract`
- [ ] `jwt-service-cache`
- [ ] `cors-policy-plugin`
- [ ] `content-sync`
- [ ] `direct-messaging`
- [ ] `elysia-observability`
- [ ] `engagement-reaction-bar`
- [ ] `entity-attribution-batch-editing`
- [ ] `realm-extra-pinboard-keys`
- [ ] `history-reference-resolution`
- [ ] `realm-tag-context`
- [ ] `realm-join-rule-consent`
- [ ] `profile-sync`
- [ ] `server-user-cache`
- [ ] `email-verification-gate`
- [ ] `app-entity-feature-architecture`
- [ ] `admin-auth-api-client`
- [ ] `default-realm-infra-bootstrap`
- [ ] `content-search-api`

For any that turn out retired, also grep `openspec/changes/` for live
references before deleting.

---

## Phase B — Normalize delta-marker specs in place

For each of the 124 specs below, apply this edit recipe:

1. Add `# <spec-name> Specification` as the first line.
2. Add a `## Purpose` paragraph (2–4 sentences, written fresh from the
   requirement text — describe what the capability owns, not what was added
   by some change).
3. Replace `## ADDED Requirements` → `## Requirements`.
4. If `## MODIFIED Requirements` is present, fold the modified requirement
   text into the canonical requirement block and remove the heading.
5. If `## REMOVED Requirements` is present, delete the listed requirements
   from the spec and remove the heading. (The behavior was already removed
   from the codebase by the corresponding archived change.)

Group the work into batches by prefix so each PR/commit stays reviewable.

### B1. Batch: `editor-*` (8 files)

- [ ] `editor-core`
- [ ] `editor-cosmos-coverage`
- [ ] `editor-emoji`
- [ ] `editor-image-insert`
- [ ] `editor-json`
- [ ] `editor-markdown`
- [ ] `editor-markdown-preview`
- [ ] `editor-mention`
- [ ] `editor-panel`
- [ ] `editor-scroll-sync`
- [ ] `editor-toolbar`

### B2. Batch: `folio-*` (7 files)

- [ ] `folio-core`
- [ ] `folio-gesture`
- [ ] `folio-ghost-snapshot`
- [ ] `folio-pagination`
- [ ] `folio-plugin-epub`
- [ ] `folio-plugin-txt`
- [ ] `folio-tree-navigation`

### B3. Batch: `shelf-*` (8 files)

- [ ] `shelf-batch-hydration`
- [ ] `shelf-collection`
- [ ] `shelf-display-modes`
- [ ] `shelf-item-kind`
- [ ] `shelf-item-unit-junction`
- [ ] `shelf-migration`
- [ ] `shelf-seed-tags`
- [ ] `shelf-structure`

### B4. Batch: `auth-*` / `jwt-*` / `independent-auth-*` (8 files)

- [ ] `auth-openapi-routes`
- [ ] `auth-token-lifecycle-provider`
- [ ] `independent-auth-server`
- [ ] `jwt-service-admin-api` *(but see Phase C — likely delete instead)*
- [ ] `jwt-service-admin-ui` *(but see Phase C — likely delete instead)*
- [ ] `jwt-service-cache`
- [ ] `shared-jwt-rotation`
- [ ] `unified-jwt-audience`
- [ ] `es256-jwks-jwt-verification`

### B5. Batch: `content-*` (4 files)

- [ ] `content-index`
- [ ] `content-rating`
- [ ] `content-search-translations`
- [ ] `content-sync`

### B6. Batch: `book-*` / `homepage-*` (3 files)

- [ ] `book-detail-language-switcher`
- [ ] `book-detail-release-selector`
- [ ] `book-library-homepage`
- [ ] `homepage-ecosystem`

### B7. Batch: `default-realm-*` (3 files)

- [ ] `default-realm-auto-join`
- [ ] `default-realm-contract`
- [ ] `default-realm-infra-bootstrap`

### B8. Batch: `dispatch-*` / `internal-event-*` (4 files)

- [ ] `dispatch-contract`
- [ ] `dispatch-result-intake`
- [ ] `dispatch-token-session`
- [ ] `internal-event-ingestion`

### B9. Batch: `notification-*` / `notify-*` (4 files)

- [ ] `notification-feed`
- [ ] `notification-stream`
- [ ] `notify-auth`
- [ ] `notify-system-email`

### B10. Batch: `profile-*` (5 files)

- [ ] `profile-content-tab`
- [ ] `profile-followers-tab`
- [ ] `profile-realms-tab`
- [ ] `profile-shelves-tab`
- [ ] `profile-sync`
- [ ] `profile-tab-layout`

### B11. Batch: `reaction-*` (4 files)

- [ ] `reaction-auth`
- [ ] `reaction-crud`
- [ ] `reaction-internal-api`
- [ ] `reaction-notification`

### B12. Batch: `realm-*` (4 files)

- [ ] `realm-search-index`
- [ ] `realm-tag-context`
- [ ] `realm-tag-interpretation-context`
- [ ] `realm-taxonomy-seed-support`

### B13. Batch: `search-*` (2 files)

- [ ] `search-query-syntax`
- [ ] `search-state-injection`

### B14. Batch: `seed-*` (2 files)

- [ ] `seed-performance-batch`
- [ ] `seed-zone`

### B15. Batch: `server-*` (2 files)

- [ ] `server-access-token`
- [ ] `server-user-cache`

### B16. Batch: `settings-*` (4 files)

- [ ] `settings-connections`
- [ ] `settings-preferences`
- [ ] `settings-profile`
- [ ] `settings-tokens`

### B17. Batch: `type-extension-*` (4 files)

- [ ] `type-extension-book`
- [ ] `type-extension-link`
- [ ] `type-extension-realm`
- [ ] `type-extension-shelf`

### B18. Batch: `unified-*` (3 files)

- [ ] `unified-access-token`
- [ ] `unified-attribution` *(but see Phase C — likely merge with `attribution`)*
- [ ] `unified-jwt-audience`

### B19. Batch: `unit-*` (3 files)

- [ ] `unit-alias-search`
- [ ] `unit-authority`
- [ ] `unit-identity`

### B20. Batch: `work-*` (3 files)

- [ ] `work-discussion`
- [ ] `work-link-claim`
- [ ] `work-release`

### B21. Batch: leftovers (~25 files)

- [ ] `admin-auth-api-client`
- [ ] `api-error-class`
- [ ] `api-route-convention`
- [ ] `app-header-search`
- [ ] `backend-prisma-error-mapping`
- [ ] `biome-config`
- [ ] `direct-messaging`
- [ ] `elysia-error-response-pattern`
- [ ] `folder-naming-convention`
- [ ] `image-upload-api`
- [ ] `image-upload-modal`
- [ ] `infra-seed`
- [ ] `language-registry`
- [ ] `lazy-user-provisioning`
- [ ] `macro-permission-guards`
- [ ] `markdown-post-content`
- [ ] `markdown-user-description`
- [ ] `meili-frontend-lists`
- [ ] `pagination-limit-contract`
- [ ] `post-kind-contract`
- [ ] `post-parallel-translation`
- [ ] `progress-search-index`
- [ ] `public-list-endpoints`
- [ ] `rezics-renderer`
- [ ] `slug-ref`
- [ ] `subdomain-trust-boundary`
- [ ] `tag-batch-translation`
- [ ] `tag-scoring`
- [ ] `tanstack-query-keys`
- [ ] `token-refresh-registry`
- [ ] `typed-json-fields`
- [ ] `typed-slug-lookup`
- [ ] `user-brief-api`
- [ ] `user-domain-decoupling`

### B22. Header-less specs (no delta markers, but no title/Purpose)

Same recipe minus steps 3–5: just add `# <name> Specification` + `## Purpose`
above the existing `## Requirements`.

- [ ] `admin-email-testing`
- [ ] `attribution`
- [ ] `auth-login-orchestration`
- [ ] `cleanup`
- [ ] `database-reset-preserve`
- [ ] `email-templates`
- [ ] `email-verification-gate`
- [ ] `engagement-reaction-bar`
- [ ] `engagement-share-action`
- [ ] `engagement-shelf-action`
- [ ] `multilingual-seed-generators`
- [ ] `outbound-link-protection`
- [ ] `post-presentation-architecture`
- [ ] `profile-reactions-tab`
- [ ] `progress-status-ui`
- [ ] `reaction-history`
- [ ] `reaction-hydration`
- [ ] `reaction-summary`
- [ ] `reaction-user-state`
- [ ] `realm-membership-me`
- [ ] `realm-score`
- [ ] `realm-tag-vote`
- [ ] `registration-identity-step`
- [ ] `score-realm-field`
- [ ] `shelf-items-batch-mutation`
- [ ] `shelf-items-editor`
- [ ] `slug-validation`
- [ ] `storybook-coverage`
- [ ] `unit-picker`
- [ ] `unit-slug`
- [ ] `unverified-user-ux`
- [ ] `user-unit-progress`

### B23. Update `openspec/config.yaml`

- [ ] Append two rules to `rules.specs`:
      `- Spec files SHALL start with '# <name> Specification' and contain a '## Purpose' section before '## Requirements'.`
      `- Spec files SHALL NOT contain '## ADDED Requirements', '## MODIFIED Requirements', or '## REMOVED Requirements' — those are change-proposal vocabulary and must be flattened during archive.`

---

## Phase C — Merge confirmed duplicates

For each pair, list both sets of requirements, ensure every one survives in
the chosen canonical spec, then delete the loser.

### C1. JWT service admin API

- [ ] Compare `jwt-service-admin-api/spec.md` against
      `auth-jwt-service-admin-api/spec.md`. If all requirements from the
      former exist in the latter, delete `jwt-service-admin-api/`.

### C2. JWT service admin UI

- [ ] Compare `jwt-service-admin-ui/spec.md` against
      `admin-auth-jwt-service-ui/spec.md`. If all requirements from the
      former exist in the latter, delete `jwt-service-admin-ui/`.

### C3. Attribution

- [ ] Compare `attribution/spec.md` against `unified-attribution/spec.md`.
      They overlap on the Attribution junction model. Decide direction:
      keep `attribution` (shorter name) and fold `unified-attribution`'s
      requirements in, then delete `unified-attribution/`.

### C4. JWT audience / token

- [ ] Audit overlap between `unified-jwt-audience`,
      `unified-access-token`, `server-access-token`,
      `token-refresh-registry`. Do not merge yet — produce a one-page note
      and add concrete merge tasks to this file if overlap exists.

---

## Phase D — Consolidate over-decomposed clusters

Each cluster gets its own short merge note (which sources collapse into
which survivor) before any file is moved. Don't execute D tasks blindly from
the suggested targets — they are starting points, not decrees.

### D1. `reaction-*` (8 → 4)

- [ ] Write merge plan: which of the 8 specs collapse into
      `reaction-api` / `reaction-hydration` / `reaction-history` /
      `reaction-notification`.
- [ ] Execute merge. Delete dropped source files.
- [ ] Candidate sources to fold:
      `reaction-auth`, `reaction-crud`, `reaction-internal-api`,
      `reaction-summary`, `reaction-user-state` → `reaction-api`.

### D2. `editor-*` (13 → 3–4)

- [ ] Write merge plan: distinguish editor *core* from plugins from
      toolbar from image flow.
- [ ] Candidate plugin-bucket sources:
      `editor-emoji`, `editor-mention`, `editor-json`, `editor-markdown`,
      `editor-markdown-preview`, `editor-scroll-sync`,
      `editor-cosmos-coverage` → `editor-plugins`.

### D3. `folio-*` (7 → 2)

- [ ] Candidates:
      `folio-gesture`, `folio-ghost-snapshot`, `folio-pagination`,
      `folio-tree-navigation` → fold into `folio-core` (or
      `folio-runtime`).
      `folio-plugin-epub`, `folio-plugin-txt` → `folio-plugins`.

### D4. `realm-tag*` (5 → 2)

- [ ] Candidates:
      `realm-tag-unit` keeps the data-model spec.
      `realm-tag-context`, `realm-tag-interpretation-context`,
      `realm-tag-vote`, `realm-taxonomy-seed-support` → fold into
      `realm-tag-governance` (or a similar consolidated name).

### D5. `shelf-*` editor concerns (11 → 5–6)

- [ ] Candidates:
      `shelf-batch-hydration`, `shelf-items-batch-mutation`,
      `shelf-items-editor`, `shelf-item-kind`, `shelf-item-unit-junction`,
      `shelf-structure` → fold into a smaller set of `shelf-items` /
      `shelf-editor` specs.

### D6. `profile-*-tab` (5 → 1)

- [ ] Fold `profile-content-tab`, `profile-followers-tab`,
      `profile-reactions-tab`, `profile-realms-tab`,
      `profile-shelves-tab` into a single `profile-tabs` spec, with each
      tab as a top-level requirement block. Keep `profile-tab-layout` as
      the layout spec.

### D7. `seed-*` (7 → 3)

- [ ] Candidates: `seed-engine` (factory + interactive editor +
      performance batch), `seed-presets` (preset library + plan modes),
      `seed-distribution` (power law + zone).

### D8. `default-realm-*` (3 → 1)

- [ ] Fold `default-realm-auto-join`, `default-realm-contract`,
      `default-realm-infra-bootstrap` into a single `default-realm` spec
      with separate requirement blocks.

### D9. Final pass

- [ ] After D1–D8, rerun the §7 methodology counts and the cluster scan.
      Identify any new over-decomposed clusters that surface and decide
      whether to continue.

---

## Progress tracker

| Phase | Status | Spec count after | Date completed |
|---|---|---|---|
| Baseline | — | 317 | 2026-05-28 |
| A | not started | — | — |
| B | not started | — | — |
| C | not started | — | — |
| D | not started | — | — |
