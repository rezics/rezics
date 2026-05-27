# Implementation Goal — Completing All Active OpenSpec Changes

> Master, linear execution plan for landing the seven active OpenSpec changes
> (excluding `introduce-api-unit-store`). Worked top to bottom, one phase at a
> time. Every phase reuses existing rezics primitives; new models are added only
> where a primitive genuinely does not exist.

## Scope

Changes covered, in execution order:

1. `complete-platform-authorization` — **foundation**
2. `complete-game-media-library-backend`
3. `define-realm-wiki-zone-experience` — **foundation slice first** (single change, phased tasks)
4. `complete-realm-community-governance`
5. `complete-admin-operations-panel`
6. `complete-public-app-product-experience`
7. `define-realm-wiki-zone-experience` — **feature slice**
8. `establish-production-deployment-foundation`

Out of scope: `introduce-api-unit-store` (deferred by request).

## Guiding Principles

- **Reuse rezics primitives.** `Unit` is the sole identity anchor; type-specific
  facts live in extension tables (Book/Game/Media/Post/Shelf/Realm); text lives
  in `UnitTranslation`; tags are scored Units via `UnitTag`; attribution is
  `Entity` + `CreditAttribution`; communities are `Realm` + `RealmMember` +
  `UnitRealm`; themed surfaces are `Zone`; work/release is `UnitWork`. Do **not**
  introduce a parallel model when one of these fits.
- **Contract-first.** All API DTOs live in `@rezics/contract`
  (`package/contract/src`); the frontend consumes them via `@rezics/api`. No
  app-local copies of contract types.
- **Domain layering.** Backend domains use
  `{domain}.api.ts/.service.ts/.mapper.ts/.types.ts` and are mounted from
  `package/server/src/index.ts`.
- **Admin = operations, not editing.** Admin surfaces are repair/authority/
  oversight; localized content always flows through the normal
  `UnitTranslation`/editor path, never admin-only fields.
- **The foundation gates everything.** `complete-platform-authorization` owns the
  policy engine, capability model, moderation, content-moderation state, and
  audit. Three downstream changes consume it; it must land first.
- **Frontend is UX-first, research-backed.** Before building any app/admin/wiki
  surface (Phases 5, 6, 7), study how mature products solve the same flow — read
  the reference repos under `/home/edge/projects/rezics/discovery/repos/` and do
  targeted web research — then design the *end-to-end* user journey so it is
  smooth, not a screen-by-screen port. See "Frontend UX Research & References".

## Dependency Graph

```
        ┌─────────────────────────────────────────────────┐
        │   1. complete-platform-authorization  (FOUNDATION)│
        │   policy engine · capability grants · enforcement │
        │   moderation cases/queues · content-mod state ·   │
        │   staff audit · auth↔server boundary events       │
        └──────┬───────────────┬───────────────┬───────────┘
               │               │               │
   ┌───────────▼──┐  ┌─────────▼────────┐  ┌───▼──────────────────┐
   │ 4. realm-    │  │ 5. admin-        │  │ 6. public-app-       │
   │ community-   │  │ operations-panel │  │ product-experience   │
   │ governance   │  │ (audit/oversight)│  │ (publish policy/DM/  │
   └──────┬───────┘  └──────────────────┘  │  report; realm nav)  │
          └──────── realm nav structure ───►└──▲───────────────────┘
                                                │
   2. game-media-library-backend ──(soft: game/media browsing)─┘
   3/7. wiki-zone  ── foundation (3) → feature (7, needs realm + app)
   8. production-deployment-foundation ── independent infra; deploys all
```

Independent of the foundation (can be built any time): `2`, `3` (wiki-zone
foundation slice), `8`.

## Execution Workflow

**Branching:** none. This is a linear pass — **commit directly onto `dev`**.

**Commit policy (autonomous):**
- Stage and commit at each logical task/section boundary (not one mega-commit
  per phase, not per file).
- Conventional Commits, scoped to the touched package, matching repo history:
  `feat(server): …`, `feat(contract): …`, `feat(app): …`, `feat(admin): …`,
  `fix(api): …`, `docs(openspec): …`, `chore(server): …`.
- Self-review the message for accuracy/scope before committing; commit
  automatically once it reads true. Do not push unless asked.
- After completing a change's tasks, mark `tasks.md` done and run
  `/opsx:archive` (or `openspec archive`) for that change.

**Per-phase error-cleanup gate (run after each phase's tasks, before moving on):**
1. Make a short cleanup plan from the failures, then auto-execute it.
2. Commands (run from repo root unless noted):
   - `bun run format` — Biome write
   - `bun run check:convention`
   - `bun run knip` — unused exports/deps
   - `bun run check:tokens` — **UI-touching phases only**
   - `bunx tsc --noEmit` **per touched package** (ignore cross-package path-alias
     errors — those are expected in isolated per-package runs)
   - `bun test` in each touched package (`bun --filter=@rezics/<pkg> test`)
   - After any schema change:
     `bun --filter=@rezics/server run prisma:generate` then
     `bun --filter=@rezics/server run prisma:migrate`
3. The gate is green when format/convention/knip pass and per-package `tsc` has no
   errors other than cross-package alias noise. Commit the cleanup
   (`chore: resolve type/lint errors after <phase>`).

**Definition of done for a phase:** all its `tasks.md` items checked, contracts
below added, cleanup gate green, change archived.

---

## Contracts to Supplement (the gaps to close before/within each phase)

These are the underspecified contracts found in review. Each is listed under the
phase that owns it. Shapes are specifications, not final code.

### Phase 1 — `complete-platform-authorization` (most gaps; gates 3 changes)

Add to `package/contract/src/permission/` (new files) and the server `governance`
domain. Pin these **before** writing the policy engine:

1. **Capability registry** — `permission/capability.ts`: a closed, namespaced key
   list + `Capability` type. Proposed keys:
   - account: `account.warn`, `account.silence`, `account.suspend`,
     `account.ban`, `account.rate_limit`
   - moderation case: `moderation.case.triage`, `moderation.case.assign`,
     `moderation.case.decide`, `moderation.case.escalate`,
     `moderation.case.reverse`
   - queues: `queue.site.decide`, `queue.realm.decide`
   - content: `content.takedown`, `content.lock`, `content.archive`,
     `content.restore`
   - other: `tag.curate`, `audit.read`
2. **Decision/denial code enum** — `permission/decision.ts`: `DecisionCode`
   values e.g. `ALLOWED`, `MISSING_CAPABILITY`, `ENFORCEMENT_ACTIVE`,
   `BLOCKED_ACCOUNT`, `CROSS_REALM_DENIED`, `LAST_OWNER_PROTECTED`,
   `RATE_LIMITED`, `NOT_MEMBER`. Used by both policy output and audit.
3. **Realm role hierarchy** — `RealmMemberRole` enum + ordering helper
   (`owner > admin > moderator > member`) with a last-owner-protection invariant.
   `RealmMember.roleKey` stays the storage column; this gives it a typed contract.
4. **Policy I/O DTO** — `PolicyInput` (actor id, resolved capabilities, active
   enforcement, realm membership/role, target ref) → `PolicyDecision`
   (`allowed: boolean`, `code: DecisionCode`, audit metadata). The single
   `decide(input)` entry the server engine implements.
5. **Schema models** (additive Prisma): `StaffGrant`, `RealmCapabilityGrant`,
   `AccountEnforcement` (+ derived account-status projection), `ModerationCase`,
   `ModerationCaseEvent`, `RealmModerationQueueItem`, `RealmModerationEvent`,
   `ContentModerationState`, `RealmContentModeration`, `StaffAuditLog`.
6. **Case-source link** — decide and document the `ModerationCase ↔ Feedback`
   relationship (FK on case vs. a `CaseSource` junction). Backfill existing
   `Feedback(REPORT)` rows.
7. **`BLOCKED` migration** — `Permission.role = BLOCKED` is downgraded to a
   *derived* projection of `AccountEnforcement`. Write the migration that converts
   existing BLOCKED users into the equivalent enforcement record.
8. **Auth↔server boundary protocol** — define the event shape, delivery mechanism
   (queue/webhook/poll), and reconciliation query for the split where
   `package/auth` owns identity/ban and `package/server` owns community
   enforcement. Extend `package/server/src/auth-boundary/`.
9. **Frontend permission hints DTO** — non-authoritative capability hints for UI;
   all real decisions stay server-side.
10. **Naming** — the server domain is `package/server/src/governance/` (a domain,
    not a new workspace package). Keep policy action families in separate files
    (`actions/account.ts`, `actions/content.ts`, `actions/realm.ts`) to avoid a
    monolithic policy file.

### Phase 2 — `complete-game-media-library-backend`

1. **`entityKinds`** (`package/contract/src/entity.ts:13`) += `game_platform`,
   `universe`.
2. **`subjectAttributionRoles`** (`package/contract/src/subject-attribution.roles.ts:3`)
   += `available_on`.
3. **`GameSystemRequirement`** Prisma model + contract: `gameUnitId`, optional
   `platformEntityId`, `tier` (`minimum` | `recommended`), optional `language`,
   optional `sourceRefId`, JSON hardware slugs (cpu/gpu/memory/vram/storage/os/
   graphicsApi), optional raw source text. Indexes on
   `gameUnitId/platformEntityId/tier/sourceRefId`.
4. **Decisions to record in `design.md`:** (a) may public users author system
   requirements without a `sourceRefId`? (b) once `ContentStructure` is canonical
   for episodes/seasons, do `episodeCount`/`seasonCount` stay as optional DTO
   fields or get removed?

### Phase 3 — `define-realm-wiki-zone-experience` (foundation slice)

1. **`UnitType.LABEL`** enum value + catalog-search exclusion rule.
2. **`WorkRealmContext`** — pin the Prisma shape (currently underspecified): a new
   top-level table `(workUnitId, realmUnitId, role, priority, locale?,
   releaseUnitId?, audit)` with uniqueness across the role/locale/release-override
   dimensions. Confirm it is a table, not `Realm.extra`/`UnitWork` JSON.
3. **`wikiZoneUnitId → Realm` persistence** — decide where this lives (a `Realm`
   column vs `Realm.extra` JSON vs an edge table) and document it.
4. **Zone wiki config** — Typebox schemas extending `Zone` JSON for
   `filters`/`navigation`/`homepage`/`theme`, with unknown-field rejection. No new
   `RealmWikiPage` table — wiki pages are `PostKind.WIKI` Units in `UnitRealm`,
   language variants grouped by `TranslationGroup`.

### Phase 4 — `complete-realm-community-governance` (consumes Phase 1)

1. **`RealmMember.state` ownership** — resolve the proposal/design mismatch:
   confirm whether `state` (active/muted/removed/banned/pending) is a new product
   column here or derived from Phase 1's member-state API. Coordinate the
   migration with Phase 1.
2. **`Realm.extra.tagView`** config schema (`flat` | `grouped` | `tree` +
   allow-viewer-switch) in `package/contract/src/realm/realm-extra.ts`.
3. **Rule version + acknowledgement DTO** — rule `Unit` ref + version + per-user
   acceptance, locale-invariant (acceptance survives locale switch).
4. **`realm-membership-me` DTO** — current-user state + capability hints (from
   Phase 1) + rule-acceptance metadata.

### Phase 5 — `complete-admin-operations-panel` (consumes Phase 1)

1. **Depend on Phase 1 `StaffAuditLog`** — do **not** build a parallel admin audit
   model. Declare the dependency in `proposal.md`.
2. **`AdminRepairJob`** contract (`package/contract/src/admin-repair-job.ts`):
   status enum (`pending`/`running`/`succeeded`/`failed`/`cancelled`), scope
   (`search`/`history-outbox`/`work-domain`/`slug`/`attribution`/`counters`),
   dry-run response shape (per-scope or polymorphic), progress, audit link. Route
   long-running jobs through `job-runner`.
3. **`AuthMainServerReconciliationWarning`** DTO — describes drift (e.g. auth user
   missing main-server profile link) + suggested repair action.
4. **Impersonation control DTO** — audit-linked, with scope/expiry.
5. **`FilterState` / `BulkAction`** table abstractions (non-blocking, but pin the
   shape before refactoring `PaginatedTable`).

### Phase 6 — `complete-public-app-product-experience` (consumes 1, 4, 2)

1. **`DashboardSummary` DTO + server endpoint** — server-side aggregation of
   progress/shelves/realms/notifications/DMs/drafts/activity/safety, with
   per-section partial-success fields so the UI renders available sections when
   one source fails. **Do not** scatter aggregation across the client.
2. **Direct messaging contract** — thread + message DTOs + server API; permission
   gated by Phase 1's policy engine. (DM does not exist yet — net-new feature.)
3. **Search release-grouping facets** — extend `package/contract/src/search` to
   group results by work (`workUnitId`); grouping happens server/Meili-side.
4. **Policy decision object in creation forms** — forms read Phase 1's
   `PolicyDecision` to render publish-denial states (silenced/banned) instead of
   optimistic success.
5. **Cache-invalidation key map** — define `@rezics/api` QueryKey namespaces so
   collect/follow/reaction/progress mutations invalidate detail + dashboard +
   profile + search consistently.

### Phase 7 — `define-realm-wiki-zone-experience` (feature slice; consumes 3, 4, 6)

No new contracts beyond Phase 3. UI/seed/test: realm Wiki tab, Zone homepage/
navigation/theme rendering (token-restricted, no arbitrary CSS), release→wiki
resolution via `WorkRealmContext`, search projection + sync hooks. Confirm the
Meili wiki-Unit projection strategy with the search pipeline early.

### Phase 8 — `establish-production-deployment-foundation` (independent infra)

No `@rezics/contract` work. Pre-reqs and "contracts" here are service boundaries:
1. Add `package/ranking/src/cluster.ts` + `WORKERS` env (currently `app.listen`
   only) — **blocks Docker image build**.
2. Add `/health` + `/ready` endpoints on `server`/`auth`/`notify`/`reaction`/
   `history` (only `ranking` has one today) — blocks healthchecks.
3. Make `ranking` internal-only: remove public CORS / public proxy route.
4. Per-unit env schemas (SOPS) must **extend** the existing per-package
   `@t3-oss/env-core` + Valibot `env.ts`, not replace them.
5. Reconcile `OBSERVABILITY_*` env var names against
   `package/shared/src/observability/config.ts` parameter names.
Then: shared multi-stage Dockerfile, Kamal orchestration, migration jobs, SOPS,
CI workflows, Cloudflare static frontends, runbooks. Requires ops prerequisites
(host, GHCR access, age key, Cloudflare account) documented in the bootstrap
runbook.

---

## Frontend UX Research & References

The frontend phases (5 admin, 6 public app, 7 wiki) must produce a coherent,
smooth user journey — not a literal port of the backend's shape. For each major
surface, run a short research pass **before** writing components:

1. **Read the reference implementations** under
   `/home/edge/projects/rezics/discovery/repos/` for the matching domain (table
   below). Study their information architecture, navigation, empty/loading/error
   states, and the *sequence of steps* a user takes — not their tech stack or
   visual style (rezics has its own design system).
2. **Web research** the specific interaction when the reference repos don't
   settle it (e.g. modern dashboard patterns, draft/publish flows, moderation
   queue ergonomics, accessible status messaging). Cite what informed the choice
   in the change's `design.md`.
3. **Map the end-to-end flow** (entry point → action → feedback → next step)
   before component work, so navigation, cache invalidation, and policy/permission
   states hang together across detail, dashboard, profile, and search.
4. **Honor the rezics design system.** Research informs *flow and IA*; visuals
   follow `rezics-design`, `@rezics/ui`, the closed token vocabulary,
   and the Apple-inspired borderless style. Load the `rezics-design` skill for
   any JSX/CSS/token work.

Reference repo → rezics surface mapping:

| Domain / surface                           | Reference repos to study                                           |
| ------------------------------------------ | ------------------------------------------------------------------ |
| Library discovery, catalog detail, reading | `calibre-web`, `kavita`, `booklore`, `inventaire`, `bookwyrm`      |
| Works / editions / fan content & shelves   | `otwarchive`, `bookwyrm`, `koha` (ILS catalog)                     |
| Community feed, dashboard, engagement, DMs | `discourse`, `nodebb`, `forem`, `flarum-framework`                 |
| Realm governance / moderation queue UX     | `discourse`, `flarum-framework` (admin + mod tools)                |
| Admin operations / back-office             | `discourse` admin, `flarum-framework` admin, `ghost` admin, `koha` |
| Wiki zones (Fandom-like)                   | `mediawiki`, `wikijs`, `bookstack`                                 |
| Publishing / draft → preview → publish     | `ghost`, `forem`                                                   |

**Autonomy to open supplementary changes.** If research reveals a frontend gap
that the existing change's scope does not cover (a missing flow, a needed shared
UI primitive, an interaction the contracts don't yet support), you may
autonomously open a new OpenSpec change (`/opsx:propose`) to capture it rather
than stretching the current change. Keep the new change scoped to the UX gap,
sequence it in this plan, and prefer reusing rezics primitives over new models.

## Phase Checklist (linear)

- [ ] **Phase 0 — Pre-flight.** Record current baseline: run the full cleanup-gate
  command set and note any pre-existing failures so new errors are
  distinguishable. Confirm `bun run dev` boots.
- [ ] **Phase 1 — platform-authorization.** Contracts §Phase 1 → schema + migration
  (incl. BLOCKED migration) → policy engine (`governance` domain, action
  families) → enforcement/moderation/queue/audit APIs → auth-boundary events →
  frontend hint DTOs. Gate. Archive.
- [ ] **Phase 2 — game-media-library-backend.** Registry additions →
  `GameSystemRequirement` → Game/Media services + mappers reusing Entity/
  SubjectAttribution/UnitTag/UnitExternalRef/ContentStructure → search projection.
  Gate. Archive.
- [ ] **Phase 3 — wiki-zone foundation slice.** `LABEL` enum → `WorkRealmContext`
  table → `wikiZoneUnitId` persistence → Zone wiki-config schemas → server
  services + queries → core APIs. Gate (do **not** archive — same change continues
  in Phase 7).
- [ ] **Phase 4 — realm-community-governance.** `RealmMember.state` resolution →
  `tagView`/rule-version/membership-me DTOs → feed/console/rules UX consuming
  Phase 1 governance APIs. Gate. Archive.
- [ ] **Phase 5 — admin-operations-panel.** *UX research first* (discourse/flarum/
  ghost/koha back-office). Declare Phase 1 audit dependency →
  `AdminRepairJob`/reconciliation/impersonation DTOs → admin shell, content/
  account/observability/governance-oversight operations (no app-side editing
  duplication). Gate. Archive.
- [ ] **Phase 6 — public-app-product-experience.** *UX research first* (map each
  journey against the reference repos + web research). `DashboardSummary` server
  aggregate → DM contract + feature → search facets → policy-aware creation forms
  → engagement/notifications/profile/settings; remove test routes; realm nav
  structure from Phase 4. Open supplementary changes for uncovered flows if
  needed. Gate (UI: include `check:tokens`). Archive.
- [ ] **Phase 7 — wiki-zone feature slice.** *UX research first* (mediawiki/wikijs/
  bookstack + Fandom-like patterns). Realm Wiki tab, Zone rendering, theme
  tokens, release→wiki link, seed + tests. Gate (include `check:tokens`).
  Archive the wiki-zone change now (both slices complete).
- [ ] **Phase 8 — production-deployment-foundation.** Ranking cluster/health/
  internal-only → Dockerfiles → Kamal → migrations → SOPS → CI → Cloudflare →
  runbooks → validation. Gate. Archive.

## Risks / Watch-items

- Phase 1 is the critical path; its underspecified contracts (capability registry,
  decision codes, boundary protocol, BLOCKED migration) must be pinned before the
  policy engine, or 4/5/6 inherit ambiguity.
- Phases 4, 5, 6 are blocked on Phase 1 — do not start them until it is archived.
- Phase 6 depends on Phase 4 (realm nav) and softly on Phase 2 (game/media
  browsing); keep that order.
- Wiki-zone is one change spanning Phases 3 and 7 — archive it only after Phase 7.
- Phase 8 needs external ops decisions (host, registry, Cloudflare, age key);
  in-repo work can proceed but deployment can't complete without them.
- Per the repo convention, cross-package path-alias `tsc` errors in isolated
  per-package runs are expected and ignored — don't chase them during the gate.
