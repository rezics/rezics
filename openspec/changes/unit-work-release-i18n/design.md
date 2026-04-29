## Context

The codebase already ships the Work-Release pattern for `BOOK` / `GAME` / `MEDIA`: `Unit.workUnitId` self-relation, `UnitTranslation.sourceReleaseUnitId` curatorial pointer, and the `package/app/src/i18n/components/WorkReleaseNav.tsx` consumer UI. The pattern is excluded from `POST` by an explicit scenario in `openspec/specs/work-release/spec.md`. POST i18n today goes through `TranslationGroup` (parallel sibling Units, one per language) — a fit for wiki content but not for "single-conceptual-entry, language-versioned" content like announcements.

The in-progress `realm-pinboard` change introduced a special-purpose `pinboard` backend that combines `UnitTranslation` (for list cards) with `TranslationGroup` (for body siblings). This dual-track is the awkwardness this change resolves: announcements should be Work-Release, not parallel siblings.

Cross-user collaboration on Work-Release i18n is currently impossible: there is no formal way for user B to assert "my Unit Y is a Release of user A's Work X" without mutual authority. Wiki types (BOOK / GAME / MEDIA) implicitly want zero-friction contribution; non-wiki types (POST) need consent.

Existing helpers / surfaces this design leans on:
- `Unit.workUnitId` self-relation (already in `package/server/prisma/schema.prisma`)
- `UnitTranslation.sourceReleaseUnitId` (already in schema; semantics formalized here)
- `react-i18next` setup at `package/app/src/app/providers/i18n.ts`
- `TranslationEditor` / `TranslationTabs` / `WorkReleaseNav` already built in `package/app/src/i18n/components/`
- `@rezics/notify` package (current capabilities to be inventoried; this change extends it)

## Goals / Non-Goals

**Goals:**

- Allow `POST` to participate in the Work-Release pattern as a first-class i18n primitive.
- Formalize "authority over a Unit" as a reusable predicate covering owner, admin, and realm-mod sources.
- Provide a permissioned cross-user linkage flow so translators can claim a Release without being able to hijack arbitrary Works.
- Make Pinboard / Announcement compose naturally over generic Unit primitives, eliminating the special-purpose `pinboard` backend.
- Move shared translation editing UI out of the app package and into `@rezics/ui` so multiple features can reuse it cleanly.
- Keep `TranslationGroup` available unchanged for genuine parallel-translation (wiki) flows.

**Non-Goals:**

- Auto-conversion between TranslationGroup and Work-Release modes for an existing Unit. Modes are chosen at content-creation time; conversion is a future-only data-migration concern.
- Versioning lineage between Releases (e.g., "R3 derives from R1"). Day-1 Releases are flat; lineage tracking is deferred.
- Release immutability / draft-publish state machines. `Post.body` on a Release remains editable (drift between body and `UnitTranslation` cache is an accepted, frontend-managed concern).
- Migrating existing pinboard data. Per project guidance ("no compatibility concerns"), we drop and start clean.
- Replacing all permission checks across the codebase with `hasAuthorityOver`. Scope is the new endpoints introduced by this change; broader migration is opportunistic.

## Decisions

### D1: Extend Work-Release to POST rather than introduce a new pattern

**Decision**: Remove the type restriction in `work-release` and add `POST` to the supported parent types. Keep the existing scenarios (release-type-must-match, no-nesting) as-is.

**Why**: The pattern is already conceptually correct for POST and runs in production for BOOK. Introducing a parallel "POST i18n" pattern would duplicate semantics and split the UI surface (`WorkReleaseNav` already speaks the language). The restriction was historical, not architectural.

**Alternatives considered**:
- Keep POST on TranslationGroup only and build a "pinboard 2.0" that hides Group complexity. **Rejected** — perpetuates the dual-track problem.
- Add a third pattern specifically for announcement-style POST. **Rejected** — Work-Release already does exactly this.

### D2: Dual i18n models on POST coexist (Group ⊥ Work-Release)

**Decision**: A POST Unit MAY carry both `translationGroupId` and `workUnitId` simultaneously without contradiction. They answer different product questions (peer-to-peer same-topic siblings vs. parent-child language versions of one entry). No mutual-exclusion constraint is added.

**Why**: A wiki POST that is later pinned and gains an English release is a real shape; forcing a choice at the schema level over-constrains a permissive system.

**Alternatives considered**:
- DB CHECK constraint forbidding both fields populated. **Rejected** — eliminates legitimate combinations and adds migration friction.

### D3: Authority predicate `hasAuthorityOver(caller, unit)`

**Decision**: Introduce a service-layer predicate at `package/server/src/unit/authority.ts` (exact path TBD during apply) returning true if any of:
- `caller.userId === unit.userId`
- caller has system admin role
- caller is a moderator (or higher) of any Realm whose `RealmUnit` rows reference this unit

The predicate is the sole authorization input for new endpoints in this change. Existing endpoints are not migrated.

**Why**: The user explicitly framed authority as distinct from ownership. Centralizing the predicate avoids ad-hoc checks and makes the admin / mod escalation paths uniform.

**Alternatives considered**:
- Inline checks at each endpoint. **Rejected** — duplicates logic and drift across endpoints.
- Casbin-style policy engine. **Rejected for now** — scope mismatch; can be revisited if authorization complexity grows.

### D4: WorkLinkClaim as an independent table

**Decision**: New Prisma model `WorkLinkClaim` with fields `id`, `releaseUnitId`, `workUnitId`, `claimerUserId`, `status` (`PENDING|APPROVED|REJECTED|WITHDRAWN`), `rejectReason?`, `createdAt`, `resolvedAt?`, `resolvedBy?`. Indexed on `(workUnitId, status)` and `(claimerUserId, status)`.

REST endpoints (mounted under `/work-link-claims` or `/units/:id/work-link-claims`):
- `POST /units/:releaseId/work-link` — main entry; either links immediately, creates a claim, or rejects (decision tree under D5).
- `GET /units/:workUnitId/work-link-claims?status=PENDING`
- `POST /work-link-claims/:claimId/approve`
- `POST /work-link-claims/:claimId/reject` body: `{ reason? }`
- `DELETE /work-link-claims/:claimId` — withdrawal by original claimer

**Why**: An independent table cleanly supports multiple concurrent claims, audit history, rejection reasons, and an inbox view. A simpler `pendingWorkUnitId` column on Unit would limit a Unit to one in-flight claim and lose the audit trail.

**Alternatives considered**:
- `Unit.pendingWorkUnitId` field. **Rejected** — single-claim limit, no history.
- Soft state (`workLinkVerified: false` on already-set link). **Rejected** — exposes hostile claims as visible-but-unverified, opening attack surface for relevance fraud.

### D5: Decision tree on `PATCH /units/:releaseId/work-link`

```
input: caller, releaseId, { workUnitId | null }

1. Require hasAuthorityOver(caller, releaseUnit) — else 403.

2. If workUnitId is null:
     - clear Unit.workUnitId
     - cascade-resolve any PENDING claims involving this release as WITHDRAWN
     - return { status: "UNLINKED" }

3. Validate workUnitId references an existing work (workUnitId is null on the target).
   Validate type match (release.type === work.type).
   Validate no nesting (workUnit.workUnitId is null).
   On any failure → 400.

4. Determine work-side approval:
   a. hasAuthorityOver(caller, workUnit) → set Unit.workUnitId immediately.
                                            return { status: "LINKED" }.
   b. workUnit.type ∈ WIKI_TYPES → set Unit.workUnitId immediately.
                                    return { status: "LINKED", autoApproved: true }.
   c. otherwise → create WorkLinkClaim(PENDING).
                  enqueue notify (D7).
                  return { status: "PENDING", claimId }.
```

**Why**: Explicit, branch-by-branch authorization. Wiki short-circuit keeps contribution friction low for catalog content. Pending claims are bounded to user-authored content where consent matters.

### D6: WIKI_TYPES constant in `@rezics/contract`

**Decision**: Export `WIKI_TYPES = ['BOOK', 'GAME', 'MEDIA'] as const` from `@rezics/contract`. Server consumes it in the work-link service; admin UI consumes it for messaging ("anyone can contribute"); future Unit types can be added by editing this constant.

**Why**: Single source of truth; co-located with the type schema; available to both frontends and backend without a config service.

**Alternatives considered**:
- Configurable per-deployment. **Rejected** — overkill for the stable platform-level distinction.
- Per-Unit `allowOpenContribution` flag. **Rejected** — the property is a function of type, not of individual unit.

### D7: Notify integration — system notification + email

**Decision**: Extend `@rezics/notify` with a single `notifySystemAndEmail(userId, payload)` API that emits both an in-system notification feed entry AND a transactional email to the user's email address. Used by:
- Claim creation → notify work-side owner.
- Claim approve / reject → notify claimer.

If `@rezics/notify` does not currently emit email at all, this change includes adding that capability (templated via the existing email package). If notify already supports email but as a separate channel, this change adds the convenience fan-out.

**Why**: Approval inbox sitting only in the in-app feed misses users who are not actively logged in. Email is the right escalation for "someone wants to attribute their content to yours". Single API call avoids burdening callers with channel orchestration.

**Risk**: Email volume on high-claim Realms. **Mitigation**: rate-limit at the notify layer; out of scope for this change but flagged.

### D8: Frontend auto-derive title/summary

**Decision**: Title / summary derivation from `Release.body` runs entirely in the browser (in the editor component). The frontend extracts derived values heuristically (e.g., first H1 / first paragraph) and writes them via the standard UnitTranslation PATCH endpoint; the backend stores whatever the client sends without recomputing.

**Why**: Keeps the heuristic mutable — UI iteration on extraction rules ships at frontend pace, no backend redeploy. Also matches the "drift is a feature" premise: the cached `title` may diverge from `body` after editorial polish, and the system stores user intent rather than recomputed content.

**Alternatives considered**:
- Backend `derive-from-source` endpoint. **Rejected** for D8 reasons — couples the heuristic to backend release cycles.
- `@rezics/ui` shared helper. **Considered acceptable**; we'll place the helper there (rather than inside `@rezics/app`) since multiple feature surfaces (book editor, future game/media editors, pinboard) benefit.

### D9: Move TranslationEditor / TranslationTabs / WorkReleaseNav to `@rezics/ui`

**Decision**: Migrate the three components out of `package/app/src/i18n/components/` into `@rezics/ui`. `WorkReleaseNav` is refactored to take `releases: Array<{ unitId; translation? }>` (or a render-prop) instead of importing `bookQueries` directly. Existing book consumers fetch with `bookQueries` (or `unitQueries`) and pass results to the component.

**Why**: All three are pure presentational concerns ripe for cross-feature reuse. The current location couples them to `@rezics/app` artificially. The `bookQueries` hard import in `WorkReleaseNav` was the only blocker; lifting it via prop-injection makes the component reusable.

**Alternatives considered**:
- Leave in place; cross-import from pinboard. **Rejected** — `package/app` should not be a de-facto shared library.
- Duplicate per feature. **Rejected** obviously.

### D10: RealmExtra contract is loose-typed with two well-known keys

**Decision**: `@rezics/contract` exports a `RealmExtraSchema` Typebox object with optional `pinboard: string[]` and `announcement: string[]` keys, with `additionalProperties: true` semantics so that callers may store arbitrary other keys. The two well-known keys carry JSDoc comments documenting their intended use, including the announcement guidance ("not for general forum notifications; reserved for special pages like the homepage announcement bar").

The English text of those comments is **also** added as locale entries under `realm.extra.<key>.note` in all five `package/app/src/locale/*.ts` files. The duplication is maintained by convention (no extraction tooling in this change).

**Why**: Preserves "trust" semantics — clients can write any keys; only the well-known two get UI hints. Avoids over-engineering a pinboard registry. Locale-side strings let the admin UI render localized warnings without the contract package depending on i18n.

**Alternatives considered**:
- Strict-typed RealmExtra (closed object). **Rejected** — kills the trust strategy.
- Build-tool extraction of JSDoc → locale files. **Rejected for now** — adds tooling for two strings; revisit if more well-known keys appear.

### D11: Read-time stale-ID handling on `Realm.extra.{pinboard,announcement}`

**Decision**: When reading these arrays, the server (or read-side helper) filters out IDs whose units no longer exist, are deleted, or are not visible to the requester. Admin views additionally surface the stale IDs (with a one-click remove). No automated cleanup job.

**Why**: Race-free, simple, matches the existing pinboard implementation's read-time tolerance.

### D12: Supersession of `realm-pinboard` change

**Decision**: The `realm-pinboard` change (54/55 tasks complete, not archived) must be **withdrawn** before this change applies. The `tasks.md` for this change includes that withdrawal step. We do not archive `realm-pinboard` because its architectural conclusions are being replaced; archiving it would freeze obsolete specs into `openspec/specs/`.

**Why**: OpenSpec archives mean "this design is now the canonical truth for this capability". `realm-pinboard`'s specs were never the truth — they were the intermediate dual-track design. Withdrawing avoids polluting the spec tree.

**Alternatives considered**:
- Archive `realm-pinboard` first, then this change marks its capabilities REMOVED. **Rejected** — adds noise to history without value.

## Risks / Trade-offs

- **Risk**: Authority predicate must touch the Auth DB (admin role) and the Server DB (RealmUnit rows). → **Mitigation**: cache admin role in the access token (already the pattern); resolve realm-mod via a single indexed JOIN on `RealmUnit (unitId, realmId)` × `RealmRole`. Add explicit perf scenarios in the spec for sub-millisecond resolution at typical realm-membership cardinalities.
- **Risk**: WorkLinkClaim email fan-out can spam. → **Mitigation**: dedupe by `(claimerUserId, workUnitId)` within a 24h window at the notify layer.
- **Risk**: Frontend auto-derive heuristic varies between editors and the cached UnitTranslation drifts. → **Mitigation**: explicit acknowledgement in D8 that drift is a feature; the editor surfaces a "regenerate from body" affordance for the user to pull the cache forward when desired.
- **Risk**: Moving UI components to `@rezics/ui` may introduce circular dependencies if `@rezics/ui` then imports from `@rezics/api`. → **Mitigation**: components accept data via props/render-props; no `@rezics/api` import inside `@rezics/ui`.
- **Risk**: Pinboard frontend rewrite breaks the realm admin page mid-flight. → **Mitigation**: development sequencing — implement new components in the same branch; switch the route imports atomically; keep the old pinboard files until the cutover commit, then delete in one step.
- **Trade-off**: Deleting existing pinboard data sacrifices any seeded announcements. Acceptable per project guidance; new seed scripts populate the new shape.
- **Trade-off**: Two i18n models on POST (Group + Work-Release) increases the conceptual surface for new contributors. Mitigated by clear documentation in `unit-translation` and `work-release` specs differentiating the two.

## Migration Plan

1. Withdraw the `realm-pinboard` change (a single command; see tasks).
2. Apply Prisma migration for `WorkLinkClaim` model.
3. Land backend changes (unit/authority, work-link endpoints, claim endpoints, notify extension).
4. Land contract changes (`RealmExtra`, `WIKI_TYPES`, work-link / claim contracts).
5. Move UI components to `@rezics/ui` and update Book consumers in the same commit.
6. Land frontend pinboard rewrite, switch realm admin page to the new section.
7. Add locale entries.
8. Delete old pinboard backend, contract, and app files.
9. Update seed mocks to populate via new primitives.
10. Run convention check, type check, tests; smoke-test the realm admin page in dev.

**Rollback**: Revert the merge commit. Database has only an additive `WorkLinkClaim` table; revert leaves it dangling but harmless (no foreign key from existing tables points at it).

## Open Questions

- Should `MEDIA` be in `WIKI_TYPES`? The user explicitly named `BOOK` and `GAME`. Default proposed: include `MEDIA` (catalog-like, encourages contribution). **Resolved during apply: yes, MEDIA is included.**
- Should withdrawing `realm-pinboard` happen as a manual step (`openspec change withdraw realm-pinboard`) or as a preflight task in this change's `tasks.md`? Default: list as a task so it's auditable. **Resolved: withdrawn before apply (commit `64bebcc2`).**
- Notify package's current capabilities — should be inventoried during apply to know exactly what extension is needed (new email transport vs. new fan-out helper).

## Notify package inventory (recorded during apply, task 1.2)

`@rezics/notify` is an Elysia HTTP service with modules `dm/`, `notification/`, `stream/`, `internal/`. The `internal/internal.api.ts` exposes a `POST /internal/event` endpoint that other services call to create a `Notification` row + SSE fan-out. **It has no email transport** — no nodemailer/resend/sendgrid dependency, no `mailer.ts`, no SMTP env vars.

`@rezics/email` is render-only (React Email components + a `render()` helper that produces `{html, text}` from a template + props). It has no transport.

The only SMTP sender in the repo is `@rezics/auth/src/notification/mailer.ts` (nodemailer pool, scoped to auth flows: invitations / password reset / verification). It reads `SMTP_HOST/PORT/USER/PASSWORD/SECURE/USER_NAME` from the auth env.

**Implication for tasks 9.x**: We add an SMTP transport directly to `@rezics/notify` (reusing the nodemailer pattern + the same SMTP env vars) and use `@rezics/email`'s `render()` for templating. No promotion of auth's mailer is required for this change; if shared SMTP becomes a recurring need later, extracting the transport into `@rezics/email` is a follow-up. The `notifySystemAndEmail` helper lives at `package/notify/src/internal/notify-system-email.ts` (or analogous), and is invoked by server callers via the existing `POST /internal/event`-style internal endpoint plus a new `POST /internal/notify-system-email` (TBD during phase C).
