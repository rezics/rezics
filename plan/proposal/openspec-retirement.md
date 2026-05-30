---
title: Drain openspec into code
status: active
created: 2026-05-29
completed:
supersededBy:
tags: [meta, cleanup, tooling]
---

## What

`openspec/` holds ~293 capability specs + 4 completed changes (378 markdown
files), plus ~312 references scattered across the repo. Almost all of it
duplicates what the code already says; the small durable part — invariants and
the irreducible *why* — belongs as comments next to the code it constrains, where
it cannot drift.

This is a cleanup, not a project. We drain the irreducible content into code and
delete the rest, slice by slice, until `openspec/` is gone and no reference
remains. There is no ceremony to perform and nothing to memorialize: once the
directory and the references are gone, openspec simply doesn't exist. This file
is the worklist that drives that loop and gets deleted with everything else at
the end.

Authoritative behavior lives in **code**: types/schemas express shape, tests
express behavior, comments express the irreducible why. Planning is code-first
via `plan/` + `/rezics-explore` / `/rezics-propose`.

## The loop

No phases. Each pass, the agent judges the batch size — anywhere from one checker
rule to a whole domain — and runs:

```
while openspec/ still exists OR any reference remains:
    pick a coherent slice (one domain / one cluster of refs / a group of changes)
    triage: is there any why/invariant here that code does NOT already capture?
        yes → route it into code (usually a one- or two-line comment)
        no  → drop it
    delete the spec/change/reference
    generate a git commit message (what moved where, what was deleted)
    commit
final cut: rm openspec/; repoint the 9 convention checkers at code;
           strip openspec from AGENTS.md / CLAUDE.md / CONTRIBUTING.md and skills
```

A coherent slice is one that commits cleanly on its own: a domain's specs
together with the source comments and checker rules that cite them. Prefer slices
that leave the tree green at every commit.

## The four-way routing rule (load-bearing)

This is the technique, applied per requirement — not per spec:

- **shape** (fields, enums, value-sets) → types / Valibot / Prisma
- **behavior** (rules, flows) → a test
- **irreducible invariant / why** → a concise comment at the owning code
- **history / migration / rename** → the git commit message, then dropped

The highest-value comments are the *non-obvious* ones: deliberate
non-restrictions ("no ancestry check", "no domain restriction on url"), security
invariants, and known staleness windows — without them a future dev "fixes"
intended behavior. Cross-cutting invariants live in the **owning** file's comment
with a one-line back-pointer at each remote site; only the genuinely scattered
ones earn a short `package/.../README.md` — a handful, not 293.

"Delete cleanly" never means `rm -rf` without reading. Route first, then delete.

## Keystone dependency

The 9 `check:convention` rules hardcode `openspec/specs/*.md` paths in their
`SPEC` constants (route-prefix, folder-naming, query-keys, safe-link, ui-autonomy,
i18n-invariants ×2, token-consumption ×2). While any of these point at
`openspec/specs/`, `rm openspec/` breaks the checker. Each rule's irreducible
*why* moves into the rule code itself (comment / error message); the spec path is
dropped. These are the last hard gate before the final cut — resolve each in its
domain slice, or sweep them all in one slice just before deletion.

## First slice — the four completed changes

`add-poll`, `add-poll-ui`, `add-post-state-schema`, `node-addressed-book-reading`
are implemented and intentionally never archived. Their decisions already live in
schema/registry/tests; only ~7 irreducible "why" notes are still only in
`design.md`. Land these comments, then delete all four change directories in one
commit.

- [ ] `add-poll` — comment `PollVote.userId` (stored even for anonymous polls, to
  guarantee one-vote-per-user and allow vote changes; anonymity is a read-path
  concern); comment in `poll.mapper.ts` (anonymous polls never expose
  userId↔optionId mappings in any DTO — only aggregates + myVote; audit access,
  if ever added, must use a separate path).
- [ ] `add-poll-ui` — comment the composer submit handler where `useCreatePoll` +
  `createPost` are sequenced (non-atomic; an orphan poll on post failure is
  acceptable and stays a standalone unit).
- [ ] `add-post-state-schema` — comment `post.service.ts` near `setState()`
  (⚠ `state` gates **no** behavior; authorization keys only on `isLocked` /
  `Unit.status`, never `state` — security-critical); expand the
  `maintainSolvedCache*` comment (`PostPin(ACCEPTED_ANSWER)` is the source of
  truth, `state = solved` is a maintained shadow; the pin wins over manual close
  reasons).
- [ ] `node-addressed-book-reading` — comment on `ContentStructureNode` / book
  service (node id is the canonical reading address: stable under TOC reorder,
  unambiguous under content reuse where the same `contentUnitId` sits at multiple
  nodes; path-addressing was the leaky abstraction the old stale-guards patched).
- [ ] delete `openspec/changes/{add-poll,add-poll-ui,add-post-state-schema,node-addressed-book-reading}/`.

## Tail — clean up this cleanup

When the inventory is empty and the references are gone:

- [ ] delete `openspec/` and `openspec/config.yaml`.
- [ ] repoint / drop the 9 convention-checker `SPEC` constants and the `openspec`
  entry in `EXEMPT_DIR_PATTERNS`.
- [ ] remove the OpenSpec skills/commands and their mirrors
  (`.claude/skills/openspec-*`, `.claude/commands/opsx/*`, `.codex/skills/openspec-*`,
  `.github/skills/openspec-*`, `.github/prompts/opsx-*`).
- [ ] strip openspec from `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`,
  `.github/copilot-instructions.md`, `plan/README.md`.
- [ ] fold the four-way routing rule into `rezics-apply`, then delete this file
  and rewrite the `openspec-retirement` memory to plain "planning is code-first
  via `plan/` + `rezics-*`" (no mention of openspec — nothing left to contrast).

## Out of scope

- Rewriting code behavior — this is a docs/tooling cleanup, not a refactor.
- Up-front conversion of every spec — the loop drains them as slices, and a spec
  left in place between passes is fine; a half-migrated spec is not.

## Inventory — specs to drain then delete (grouped by domain)

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
