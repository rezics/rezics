---
title: OpenSpec retirement — return to code-first
status: active
created: 2026-05-29
completed:
supersededBy:
tags: [meta, openspec, tooling, cleanup]
---

## Why

OpenSpec holds ~293 capability specs (378 markdown files) that duplicate what the
code already says (shape, value-sets) and accrete content that is dead after a
change lands (migration steps, rename maps). The durable, irreducible part —
invariants and *why* — would serve better as comments next to the code it
constrains, where it cannot drift. This plan retires OpenSpec and returns
authoritative behavior to **code**: types/schemas express shape, tests express
behavior, comments express the irreducible why. Planning moves to `plan/` with
`/rezics-explore` and `/rezics-propose`.

End state: `openspec/` is deleted; the OpenSpec skills are removed; all durable
knowledge lives in code, comments, and tests.

## Durable constraints & decisions

- `(comment)` The four-way routing rule is the heart of this work and must be
  applied per requirement, not per spec: **shape → types/Valibot/Prisma**,
  **behavior → a test**, **irreducible invariant/why → a concise comment at the
  owning code**, **history/migration/rename → the git commit message (drop)**.
  Deliberate non-restrictions (e.g. "no ancestry check", "no domain restriction
  on url") and known staleness windows are the highest-value comments — without
  them a future dev "fixes" intended behavior.
- `(comment)` Cross-cutting invariants (e.g. "hard gates depend only on
  `isLocked`/`Unit.status`, never on `Post.state`") live in the **owning** file's
  comment, with a one-line back-pointer at each remote site. Only the genuinely
  scattered ones earn a short `package/.../README.md` — a handful, not 293.
- This is **incremental, not big-bang**. Phase 1 default is "migrate a domain's
  spec only when you next touch that domain." A spec left in place is acceptable;
  a half-migrated spec is not.
- In-flight changes (`add-poll`, `add-poll-ui`, `add-post-state-schema`,
  `node-addressed-book-reading`) are essentially complete. **Archive them with
  the existing OpenSpec flow**; do not port them to the new workflow.
- Do not delete `openspec/` until the inventory below is fully checked. Deletion
  is a human action.

## Tasks

### Phase 0 — stop the bleeding
- [ ] 0.1 Adopt `/rezics-propose` for all **new** work; create no new `openspec/changes/*`.
- [ ] 0.2 Archive the four in-flight changes via `openspec-archive-change` once their working trees are committed.
- [ ] 0.3 Note in `AGENTS.md` that planning is code-first via `plan/` + `rezics-explore`/`rezics-propose`, and that OpenSpec is being retired (point to this plan).

### Phase 1 — migrate specs to code (per domain, when touched)
For each spec below: triage every requirement with the four-way rule, land the
comments/tests, then delete that `spec.md`. Tick the box when the spec is gone.

### Phase 2 — finish & remove
- [ ] 2.1 When the inventory is empty, delete `openspec/`.
- [ ] 2.2 Remove OpenSpec skills (`openspec-*`, `opsx:*`) and any OpenSpec CLI config.
- [ ] 2.3 Strip OpenSpec references from `AGENTS.md` / `CLAUDE.md` / `CONTRIBUTING.md`.

## Out of scope

- Rewriting code behavior — this is a documentation/tooling migration, not a refactor.
- Porting in-flight changes to the new workflow (they finish under OpenSpec).
- Converting every spec up front (Phase 1 is lazy, touch-driven).

## Inventory — specs to migrate then delete (grouped by domain)

### unit & entity (44)
- [ ] `attribution`
- [ ] `attribution-api-client`
- [ ] `entity-admin-page`
- [ ] `entity-attribution-batch-editing`
- [ ] `entity-detail-page`
- [ ] `entity-picker`
- [ ] `entity-search-index`
- [ ] `entity-self-claim`
- [ ] `entity-service`
- [ ] `entity-unit-type`
- [ ] `external-services-docker`
- [ ] `generic-label-unit`
- [ ] `series-content-index`
- [ ] `series-content-structure`
- [ ] `series-editing-experience`
- [ ] `series-work-domain-projection`
- [ ] `slug-ref`
- [ ] `slug-validation`
- [ ] `subject-attribution`
- [ ] `typed-json-fields`
- [ ] `typed-slug-lookup`
- [ ] `type-extension-book`
- [ ] `type-extension-game`
- [ ] `type-extension-link`
- [ ] `type-extension-media`
- [ ] `type-extension-post`
- [ ] `type-extension-realm`
- [ ] `type-extension-shelf`
- [ ] `unit-ai-disclosure`
- [ ] `unit-alias-search`
- [ ] `unit-authority`
- [ ] `unit-card`
- [ ] `unit-identity`
- [ ] `unit-picker`
- [ ] `unit-publication-policy`
- [ ] `unit-ranking`
- [ ] `unit-resolver`
- [ ] `unit-slug`
- [ ] `unit-translation`
- [ ] `unit-work-domain`
- [ ] `work-discussion`
- [ ] `work-link-claim`
- [ ] `work-realm-context`
- [ ] `work-release`

### auth & identity (35)
- [ ] `account-identity-boundary`
- [ ] `account-safety-enforcement`
- [ ] `auth-admin`
- [ ] `auth-jwt-service-admin-api`
- [ ] `auth-login-orchestration`
- [ ] `auth-openapi-contracts`
- [ ] `auth-openapi-routes`
- [ ] `auth-token-lifecycle-provider`
- [ ] `auth-user-provisioning-hook`
- [ ] `capability-grants`
- [ ] `cross-site-auth-presence`
- [ ] `default-realm`
- [ ] `es256-jwks-jwt-verification`
- [ ] `frontend-auth-state-separation`
- [ ] `frontend-server-permission`
- [ ] `identity-claim-consistency`
- [ ] `jwt-service-admin-api`
- [ ] `jwt-service-admin-ui`
- [ ] `jwt-service-cache`
- [ ] `jwt-token-resolver-plugin`
- [ ] `macro-permission-guards`
- [ ] `main-auth-public-boundary`
- [ ] `main-email-verification-contracts`
- [ ] `main-owned-account-registration`
- [ ] `main-token-wallet-context`
- [ ] `opaque-auth-session-refresh`
- [ ] `registration-completion-page`
- [ ] `registration-identity-step`
- [ ] `server-access-token`
- [ ] `server-permission-guards`
- [ ] `server-permission-model`
- [ ] `subdomain-trust-boundary`
- [ ] `token-refresh-registry`
- [ ] `unified-access-token`
- [ ] `unified-jwt-audience`

### content & editor (34)
- [ ] `composed-editors`
- [ ] `content-authority`
- [ ] `content-creation-work-matching`
- [ ] `content-doc-schema`
- [ ] `content-history-compare-ui`
- [ ] `content-history-restore-ux`
- [ ] `content-history-service`
- [ ] `content-index`
- [ ] `content-moderation-overlay`
- [ ] `content-rating`
- [ ] `content-search-api`
- [ ] `content-search-contract`
- [ ] `content-search-translations`
- [ ] `content-structure`
- [ ] `content-sync`
- [ ] `editor-commit-history-boundary`
- [ ] `editor-core`
- [ ] `editor-entry-policy`
- [ ] `editorial-moderation-boundary`
- [ ] `editorial-patch-protocol`
- [ ] `editor-image-insert`
- [ ] `editor-panel`
- [ ] `editor-plugins`
- [ ] `editor-toolbar`
- [ ] `folio-core`
- [ ] `folio-plugins`
- [ ] `history-product-ui`
- [ ] `history-reference-resolution`
- [ ] `markdown-user-description`
- [ ] `review-remark-ux`
- [ ] `revision-compare`
- [ ] `rezics-renderer`
- [ ] `wiki-content-creation`
- [ ] `wiki-post-editing`

### app & ui (33)
- [ ] `app-auth-onboarding`
- [ ] `app-community-engagement`
- [ ] `app-creation-workflows`
- [ ] `app-entity-feature-architecture`
- [ ] `app-header-search`
- [ ] `app-library-workflows`
- [ ] `app-personal-dashboard`
- [ ] `app-product-navigation`
- [ ] `app-quality-states`
- [ ] `app-search-feature`
- [ ] `biome-config`
- [ ] `book-detail-language-switcher`
- [ ] `book-detail-release-selector`
- [ ] `book-detail-tab-layout`
- [ ] `book-library-homepage`
- [ ] `cookie-consent-ui`
- [ ] `design-system-adoption`
- [ ] `design-system-density`
- [ ] `design-system-foundation`
- [ ] `design-system-storybook`
- [ ] `design-system-voice-patterns`
- [ ] `dissolve-app-shell`
- [ ] `homepage-ecosystem`
- [ ] `icon-system`
- [ ] `list-empty-state`
- [ ] `progress-status-ui`
- [ ] `score-input-primitive`
- [ ] `storybook-coverage`
- [ ] `tag-interaction-component`
- [ ] `ui-component-foundation`
- [ ] `ui-package-autonomy`
- [ ] `unverified-user-ux`
- [ ] `user-hover-preview`

### post & engagement (24)
- [ ] `direct-messaging`
- [ ] `dm-api-client`
- [ ] `engagement-reaction-bar`
- [ ] `engagement-share-action`
- [ ] `engagement-shelf-action`
- [ ] `engagement-subscription`
- [ ] `markdown-post-content`
- [ ] `notification-feed`
- [ ] `notification-stream`
- [ ] `notify-auth`
- [ ] `notify-system-email`
- [ ] `official-question-tag`
- [ ] `post-kind-contract`
- [ ] `post-parallel-translation`
- [ ] `post-pinning`
- [ ] `post-presentation-architecture`
- [ ] `post-reply-composer`
- [ ] `post-search-index`
- [ ] `post-thread-ui`
- [ ] `post-tree-index`
- [ ] `reaction-api`
- [ ] `reaction-history`
- [ ] `reaction-hydration`
- [ ] `reaction-notification`

### realm & zone (23)
- [ ] `realm-community-lifecycle`
- [ ] `realm-extra-pinboard-keys`
- [ ] `realm-feed-query`
- [ ] `realm-forum-composer`
- [ ] `realm-frontend`
- [ ] `realm-governance-policy`
- [ ] `realm-join-rule-consent`
- [ ] `realm-management-console`
- [ ] `realm-membership-me`
- [ ] `realm-moderation-workflow`
- [ ] `realm-post-junction`
- [ ] `realm-score`
- [ ] `realm-search-index`
- [ ] `realm-tag-governance`
- [ ] `realm-tag-unit`
- [ ] `realm-wiki-entry`
- [ ] `site-governance-policy`
- [ ] `site-staff-console`
- [ ] `wiki-zone-homepage`
- [ ] `wiki-zone-navigation`
- [ ] `wiki-zone-theme`
- [ ] `zone-frontend`
- [ ] `zone-model`

### server & api (17)
- [ ] `api-cache-coherence`
- [ ] `api-error-class`
- [ ] `api-route-convention`
- [ ] `backend-prisma-error-mapping`
- [ ] `cleanup`
- [ ] `convention-enforcement`
- [ ] `development-stage-compatibility`
- [ ] `elysia-error-response-pattern`
- [ ] `elysiajs-cors-integration`
- [ ] `elysia-observability`
- [ ] `folder-naming-convention`
- [ ] `pagination-limit-contract`
- [ ] `public-list-endpoints`
- [ ] `public-series-model`
- [ ] `public-short-routes`
- [ ] `server-route-cleanup`
- [ ] `server-user-cache`

### profile & settings (12)
- [ ] `profile-overview`
- [ ] `profile-setup-session`
- [ ] `profile-sync`
- [ ] `profile-tab-layout`
- [ ] `profile-tabs`
- [ ] `settings-account`
- [ ] `settings-connections`
- [ ] `settings-layout`
- [ ] `settings-preferences`
- [ ] `settings-profile`
- [ ] `settings-security`
- [ ] `settings-tokens`

### misc (12)
- [ ] `edit-console-layout`
- [ ] `edit-console-navigation`
- [ ] `independent-auth-server`
- [ ] `lazy-user-provisioning`
- [ ] `library-content-metadata`
- [ ] `moderation-case-workflow`
- [ ] `rezics-oauth-oidc-provider`
- [ ] `shared-email-sender`
- [ ] `shared-jwt-rotation`
- [ ] `source-site-attribution-evidence`
- [ ] `staff-audit-log`
- [ ] `system-status-feature`

### admin (10)
- [ ] `admin-account-operations`
- [ ] `admin-auth-api-client`
- [ ] `admin-auth-jwt-service-ui`
- [ ] `admin-auth-pages`
- [ ] `admin-content-operations`
- [ ] `admin-data-integrity-operations`
- [ ] `admin-email-testing`
- [ ] `admin-governance-oversight`
- [ ] `admin-observability-operations`
- [ ] `admin-operations-shell`

### infra & seed (10)
- [ ] `database-reset-preserve`
- [ ] `infra-seed`
- [ ] `internal-event-ingestion`
- [ ] `job-runner-sync-infrastructure`
- [ ] `multilingual-seed-generators`
- [ ] `multilingual-ui`
- [ ] `production-deployment`
- [ ] `seed-distribution`
- [ ] `seed-engine`
- [ ] `seed-presets`

### search (8)
- [ ] `federated-search`
- [ ] `meili-admin-observability`
- [ ] `meili-frontend-lists`
- [ ] `meili-partial-sync`
- [ ] `query-error-display`
- [ ] `search-query-syntax`
- [ ] `search-state-injection`
- [ ] `tanstack-query-keys`

### shelf (7)
- [ ] `shelf-collection`
- [ ] `shelf-discussion`
- [ ] `shelf-display-modes`
- [ ] `shelf-editor`
- [ ] `shelf-items`
- [ ] `shelf-migration`
- [ ] `shelf-seed-tags`

### score & progress (6)
- [ ] `progress-search-index`
- [ ] `score-realm-field`
- [ ] `user-brief-api`
- [ ] `user-content-node-progress`
- [ ] `user-domain-decoupling`
- [ ] `user-unit-progress`

### media & link (4)
- [ ] `image-upload-api`
- [ ] `image-upload-modal`
- [ ] `link-api-client`
- [ ] `outbound-link-protection`

### i18n (4)
- [ ] `i18n-namespace-architecture`
- [ ] `i18n-toolchain`
- [ ] `language-registry`
- [ ] `react-i18n-adapter`

### dispatch (3)
- [ ] `dispatch-contract`
- [ ] `dispatch-result-intake`
- [ ] `dispatch-token-session`

### email (3)
- [ ] `email-otp-verification`
- [ ] `email-templates`
- [ ] `email-verification-gate`

### tag (2)
- [ ] `tag-batch-translation`
- [ ] `tag-scoring`

### game (2)
- [ ] `game-media-library-backend`
- [ ] `game-system-requirements`

_Total: 293 specs._
