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

- [x] `openspec/specs/auth-organization/` — deleted 2026-05-28. File stated
      "This capability has been retired." No active references in
      `openspec/changes/`.
- [x] `openspec/specs/exchange-auto-provision/` — deleted 2026-05-28. File
      stated "This capability has been retired." No active references in
      `openspec/changes/`.

Verification: confirmed via `grep -r` that nothing in `openspec/changes/`
references these names as an active dependency.

### A2. Sweep phrase-match candidates

Read the Purpose of each of the following specs and decide whether the
capability is genuinely active or a leftover. Delete the retired ones; for
the rest, copy their actual status into the comment of this task so the next
reader can skip them.

Statuses recorded 2026-05-28 after reading each Purpose paragraph and
scanning for `has been retired` / `DEPRECATED` / `## Status` markers.

- [x] `development-stage-compatibility` — KEEP. Purpose defines an active
      rule about internal forwarding surfaces; 1 active requirement.
- [x] `engagement-subscription` — KEEP. Active capability owning the
      unified Subscription edge model; 8 requirements.
- [x] `attribution` — KEEP. Active attribution junction model; 12
      requirements. (Phase C will merge with `unified-attribution`.)
- [x] `app-search-feature` — KEEP. Active search feature entry point;
      26 requirements. "(which has been removed)" refers to one internal
      type, not the capability.
- [x] `api-cache-coherence` — KEEP. Active capability; 5 requirements.
- [x] `cross-site-auth-presence` — KEEP. Active auth-presence cookie
      capability referenced by `exchange-auto-provision` retirement note.
- [x] `dispatch-token-session` — KEEP. Active capability; 2 requirements.
- [x] `convention-enforcement` — KEEP. Active capability; 9 requirements.
- [x] `auth-token-lifecycle-provider` — KEEP. Active capability; 7
      requirements.
- [x] `database-reset-preserve` — KEEP. Active capability; 4 requirements.
- [x] `content-search-contract` — KEEP. Active capability; 17 requirements.
- [x] `jwt-service-cache` — KEEP. Active capability; 6 requirements.
- [x] `cors-policy-plugin` — DELETED 2026-05-28. Self-declared DEPRECATED
      status; all requirements removed; superseded by
      `elysiajs-cors-integration`. No active references.
- [x] `content-sync` — KEEP. Active capability; 13 requirements.
- [x] `direct-messaging` — KEEP. Active capability; 7 requirements.
- [x] `elysia-observability` — KEEP. Active capability; 9 requirements.
- [x] `engagement-reaction-bar` — KEEP. Active capability; 10 requirements.
- [x] `entity-attribution-batch-editing` — KEEP. Active capability; 4
      requirements.
- [x] `realm-extra-pinboard-keys` — KEEP. Active capability; 9 requirements.
- [x] `history-reference-resolution` — KEEP. Active capability; 4
      requirements.
- [x] `realm-tag-context` — KEEP for Phase A. Active capability; 15
      requirements. (Phase D4 may fold into `realm-tag-governance`.)
- [x] `realm-join-rule-consent` — KEEP. Active capability; 4 requirements.
- [x] `profile-sync` — KEEP. Active capability; 2 requirements.
- [x] `server-user-cache` — KEEP. Active capability; 6 requirements.
- [x] `email-verification-gate` — KEEP. Active capability; 2 requirements.
- [x] `app-entity-feature-architecture` — KEEP. Active capability; 5
      requirements.
- [x] `admin-auth-api-client` — KEEP. Active capability; 18 requirements.
- [x] `default-realm-infra-bootstrap` — KEEP for Phase A. Active capability;
      6 requirements. (Phase D8 will fold into single `default-realm`.)
- [x] `content-search-api` — KEEP. Active capability; 21 requirements.

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

### B1. Batch: `editor-*` (11 files) — done 2026-05-28

- [x] `editor-core`
- [x] `editor-cosmos-coverage`
- [x] `editor-emoji`
- [x] `editor-image-insert`
- [x] `editor-json`
- [x] `editor-markdown`
- [x] `editor-markdown-preview`
- [x] `editor-mention`
- [x] `editor-panel`
- [x] `editor-scroll-sync`
- [x] `editor-toolbar`

### B2. Batch: `folio-*` (7 files) — done 2026-05-28

- [x] `folio-core`
- [x] `folio-gesture`
- [x] `folio-ghost-snapshot`
- [x] `folio-pagination`
- [x] `folio-plugin-epub`
- [x] `folio-plugin-txt`
- [x] `folio-tree-navigation`

### B3. Batch: `shelf-*` (8 files) — done 2026-05-28

- [x] `shelf-batch-hydration`
- [x] `shelf-collection`
- [x] `shelf-display-modes`
- [x] `shelf-item-kind`
- [x] `shelf-item-unit-junction`
- [x] `shelf-migration`
- [x] `shelf-seed-tags`
- [x] `shelf-structure`

### B4. Batch: `auth-*` / `jwt-*` / `independent-auth-*` (9 files) — done 2026-05-28

- [x] `auth-openapi-routes`
- [x] `auth-token-lifecycle-provider` *(was MODIFIED-only; folded into Requirements)*
- [x] `independent-auth-server`
- [x] `jwt-service-admin-api` *(but see Phase C — likely delete instead)*
- [x] `jwt-service-admin-ui` *(but see Phase C — likely delete instead)*
- [x] `jwt-service-cache`
- [x] `shared-jwt-rotation`
- [x] `unified-jwt-audience`
- [x] `es256-jwks-jwt-verification`

### B5. Batch: `content-*` (4 files) — done 2026-05-28

- [x] `content-index`
- [x] `content-rating`
- [x] `content-search-translations`
- [x] `content-sync`

### B6. Batch: `book-*` / `homepage-*` (4 files) — done 2026-05-28

- [x] `book-detail-language-switcher`
- [x] `book-detail-release-selector`
- [x] `book-library-homepage`
- [x] `homepage-ecosystem`

### B7. Batch: `default-realm-*` (3 files) — done 2026-05-28

- [x] `default-realm-auto-join`
- [x] `default-realm-contract`
- [x] `default-realm-infra-bootstrap`

### B8. Batch: `dispatch-*` / `internal-event-*` (4 files) — done 2026-05-28

- [x] `dispatch-contract`
- [x] `dispatch-result-intake`
- [x] `dispatch-token-session`
- [x] `internal-event-ingestion`

### B9. Batch: `notification-*` / `notify-*` (4 files) — done 2026-05-28

- [x] `notification-feed`
- [x] `notification-stream`
- [x] `notify-auth`
- [x] `notify-system-email`

### B10. Batch: `profile-*` (6 files) — done 2026-05-28

- [x] `profile-content-tab`
- [x] `profile-followers-tab`
- [x] `profile-realms-tab`
- [x] `profile-shelves-tab`
- [x] `profile-sync`
- [x] `profile-tab-layout`

### B11. Batch: `reaction-*` (4 files) — done 2026-05-28

- [x] `reaction-auth`
- [x] `reaction-crud`
- [x] `reaction-internal-api`
- [x] `reaction-notification`

### B12. Batch: `realm-*` (4 files) — done 2026-05-28

- [x] `realm-search-index`
- [x] `realm-tag-context`
- [x] `realm-tag-interpretation-context`
- [x] `realm-taxonomy-seed-support`

### B13. Batch: `search-*` (2 files) — done 2026-05-28

- [x] `search-query-syntax`
- [x] `search-state-injection`

### B14. Batch: `seed-*` (2 files) — done 2026-05-28

- [x] `seed-performance-batch`
- [x] `seed-zone`

### B15. Batch: `server-*` (2 files) — done 2026-05-28

- [x] `server-access-token`
- [x] `server-user-cache`

### B16. Batch: `settings-*` (4 files) — done 2026-05-28

- [x] `settings-connections`
- [x] `settings-preferences`
- [x] `settings-profile`
- [x] `settings-tokens`

### B17. Batch: `type-extension-*` (4 files) — done 2026-05-28

- [x] `type-extension-book`
- [x] `type-extension-link`
- [x] `type-extension-realm`
- [x] `type-extension-shelf`

### B18. Batch: `unified-*` (3 files) — done 2026-05-28

- [x] `unified-access-token`
- [x] `unified-attribution` *(but see Phase C — likely merge with `attribution`)*
- [x] `unified-jwt-audience`

### B19. Batch: `unit-*` (3 files) — done 2026-05-28

- [x] `unit-alias-search`
- [x] `unit-authority`
- [x] `unit-identity`

### B20. Batch: `work-*` (3 files) — done 2026-05-28

- [x] `work-discussion`
- [x] `work-link-claim`
- [x] `work-release`

### B21. Batch: leftovers (~33 files) — done 2026-05-28

- [x] `admin-auth-api-client`
- [x] `api-error-class`
- [x] `api-route-convention`
- [x] `app-header-search`
- [x] `backend-prisma-error-mapping`
- [x] `biome-config`
- [x] `direct-messaging`
- [x] `elysia-error-response-pattern`
- [x] `folder-naming-convention`
- [x] `image-upload-api`
- [x] `image-upload-modal`
- [x] `infra-seed`
- [x] `language-registry`
- [x] `lazy-user-provisioning`
- [x] `macro-permission-guards`
- [x] `markdown-post-content`
- [x] `markdown-user-description`
- [x] `meili-frontend-lists`
- [x] `pagination-limit-contract`
- [x] `post-kind-contract`
- [x] `post-parallel-translation`
- [x] `progress-search-index`
- [x] `public-list-endpoints`
- [x] `rezics-renderer`
- [x] `slug-ref`
- [x] `subdomain-trust-boundary`
- [x] `tag-batch-translation`
- [x] `tag-scoring`
- [x] `tanstack-query-keys`
- [x] `token-refresh-registry`
- [x] `typed-json-fields`
- [x] `typed-slug-lookup`
- [x] `user-brief-api`
- [x] `user-domain-decoupling`

### B22. Header-less specs (no delta markers, but no title/Purpose) — done 2026-05-28

Same recipe minus steps 3–5: just add `# <name> Specification` + `## Purpose`
above the existing `## Requirements`.

- [x] `admin-email-testing`
- [x] `attribution`
- [x] `auth-login-orchestration`
- [x] `cleanup`
- [x] `database-reset-preserve`
- [x] `email-templates`
- [x] `email-verification-gate`
- [x] `engagement-reaction-bar`
- [x] `engagement-share-action`
- [x] `engagement-shelf-action`
- [x] `multilingual-seed-generators`
- [x] `outbound-link-protection`
- [x] `post-presentation-architecture`
- [x] `profile-reactions-tab`
- [x] `progress-status-ui`
- [x] `reaction-history`
- [x] `reaction-hydration`
- [x] `reaction-summary`
- [x] `reaction-user-state`
- [x] `realm-membership-me`
- [x] `realm-score`
- [x] `realm-tag-vote`
- [x] `registration-identity-step`
- [x] `score-realm-field`
- [x] `shelf-items-batch-mutation`
- [x] `shelf-items-editor`
- [x] `slug-validation`
- [x] `storybook-coverage`
- [x] `unit-picker`
- [x] `unit-slug`
- [x] `unverified-user-ux`
- [x] `user-unit-progress`

Also added titles to nine previously-pure-Purpose specs surfaced by the
final sweep: `server-route-cleanup`, `type-extension-post`,
`zone-frontend`, `zone-model`, `post-thread-ui`, `shelf-discussion`,
`engagement-subscription`, `unit-publication-policy`,
`unit-ai-disclosure`. `server-route-cleanup` retains its
`## Removed Requirements` section as historical documentation of the
deleted route surface (not the all-caps delta vocabulary the recipe
targets).

### B23. Update `openspec/config.yaml` — done 2026-05-28

- [x] Appended two rules to `rules.specs`:
      `- Spec files SHALL start with '# <name> Specification' and contain a '## Purpose' section before '## Requirements'.`
      `- Spec files SHALL NOT contain '## ADDED Requirements', '## MODIFIED Requirements', or '## REMOVED Requirements' — those are change-proposal vocabulary and must be flattened during archive.`

---

## Phase C — Merge confirmed duplicates

For each pair, list both sets of requirements, ensure every one survives in
the chosen canonical spec, then delete the loser.

### C1. JWT service admin API — kept both 2026-05-28

- [x] Compared `jwt-service-admin-api/spec.md` against
      `auth-jwt-service-admin-api/spec.md`. **Conclusion: not duplicates.**
      `jwt-service-admin-api` defines `/admin/jwt-services` on the
      **main server** (ROOT role); `auth-jwt-service-admin-api` defines
      `/api/auth/admin/jwt-services` on the **auth service** (owner
      role). They are parallel admin surfaces, one per service, sharing
      the same DTO schema by design. Updated `jwt-service-admin-api`'s
      Purpose to call out the "main server" scope and remove the
      "Phase C target — will be deleted" hint.

### C2. JWT service admin UI — kept both 2026-05-28

- [x] Compared `jwt-service-admin-ui/spec.md` against
      `admin-auth-jwt-service-ui/spec.md`. **Conclusion: not duplicates.**
      `jwt-service-admin-ui` covers the dashboard's main-server JWT
      records list/detail/activate/deactivate, including the explicit
      "Auth JWT Services menu entry SHALL NOT be visible to non-owners"
      callout that references the parallel auth UI. The other spec
      owns the auth-service equivalent, including direct auth-service
      base URL communication and rotation confirmation. Updated
      `jwt-service-admin-ui`'s Purpose for the same reason as C1.

### C3. Attribution — merged 2026-05-28

- [x] Folded `unified-attribution`'s requirements into `attribution`
      and deleted `openspec/specs/unified-attribution/`. The merge
      added cascade-delete scenarios on both FK sides, the
      Meilisearch-sync-on-link/unlink contract, the
      retrieve-with-translations service path (and the
      `bookQueries.detail()` translations-included clause), and the
      `CreditAttributionDTO` / `LinkAttributionInput` / `bookRoles`
      contract DTO requirement. The free-form-role scenario from
      `unified-attribution` was intentionally dropped because the
      `attribution` spec's registry-validation rule is the newer
      decision and supersedes it. `attribution` retains its
      `CreditAttribution` naming.

### C4. JWT audience / token — audited, keeping all four 2026-05-28

- [x] Audited overlap among `unified-jwt-audience`,
      `unified-access-token`, `server-access-token`, and
      `token-refresh-registry`. **Conclusion: layered, not duplicate.**
      Each owns a distinct concern of the same architecture:
      - `unified-jwt-audience` — `aud` claim policy (`rezics` default,
        env override, bootstrap upsert).
      - `unified-access-token` — cross-service architectural rule that
        `rezics-session-token` is the sole bearer credential and the
        `x-auth-session-token` header MUST NOT appear anywhere
        (CORS allowedHeaders, request headers, refresh flows).
      - `server-access-token` — main-server-side issuance schema:
        claims (`sub`, `userId`, `permission.role`, `iss`, `exp`,
        `iat`), ES256 / JWKS signing, 15-minute TTL, the
        role-as-rejection-hint rule, the bearer convention split
        between `/token` + `/dispatch` (API tokens) and everything
        else (session tokens).
      - `token-refresh-registry` — frontend `AuthProvider` registry,
        constrained to a single `REZICS_SESSION` entry refreshed via
        the cookie boundary, with the non-retryable transition to
        anonymous when the auth cookie is rejected.
      The four cover different layers (audience claim / cross-service
      principle / server-side issuance / frontend refresh client) and
      remain small and focused. Merging would create a single
      catch-all "token" spec with no clear ownership boundary, so no
      merge is recommended. No follow-up tasks added.

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
| A | done | 314 | 2026-05-28 |
| B | done | 314 | 2026-05-28 |
| C | done | 313 | 2026-05-28 |
| D | not started | — | — |

Phase B was editorial — no specs were added or deleted, so the spec
count is unchanged. Every spec now starts with
`# <name> Specification`, has a `## Purpose` section, and uses a single
`## Requirements` heading. `openspec/config.yaml` codifies the new
format under `rules.specs`.

Phase C reduced the catalog by one (`unified-attribution` folded into
`attribution`). The other three pairs/clusters audited (`jwt-service-*`
×2, JWT/token quartet) were kept as parallel or layered specs after
inspection rather than merged on intuition.

Phase A reduction: 3 capabilities removed (`auth-organization`,
`exchange-auto-provision`, `cors-policy-plugin`). Requirement count:
2240 → 2239.
