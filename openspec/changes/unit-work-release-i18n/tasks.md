## 1. Preflight

- [x] 1.1 Withdraw the in-progress `realm-pinboard` change (run `openspec change withdraw realm-pinboard` or equivalent) and confirm `openspec/changes/realm-pinboard/` is removed; the supersession is recorded in this change's design.md (D12).
- [x] 1.2 Inventory current `@rezics/notify` capabilities by reading `package/notify/src/` to confirm whether email transport already exists; record findings in a short note inside this change's `design.md` "Open Questions" section before extending.
- [x] 1.3 Confirm with reviewer that `MEDIA` is included in `WIKI_TYPES` (see Open Questions in design.md). Default: yes.

## 2. Database & Prisma

- [x] 2.1 In `package/server/prisma/schema.prisma`, add `enum ClaimStatus { PENDING APPROVED REJECTED WITHDRAWN }`.
- [x] 2.2 In `package/server/prisma/schema.prisma`, add the `WorkLinkClaim` model with fields `id`, `releaseUnitId`, `workUnitId`, `claimerUserId`, `status` (`ClaimStatus`), `rejectReason?`, `createdAt`, `resolvedAt?`, `resolvedBy?`; foreign keys to `Unit` (cascade) and `User`; compound indexes `(workUnitId, status)` and `(claimerUserId, status)`.
- [ ] 2.3 Run `bun run prisma:migrate` to generate and apply the migration; commit the new migration directory under `package/server/prisma/migrations/`. **Deferred to user — working tree contains an untracked migration `20260429120000_tag_pin_and_realm_vote/` for another in-progress openspec change; running `prisma migrate dev` here would entangle the two. User should run after coordinating with that change.**
- [x] 2.4 Run `bun run prisma:generate` and verify the new types are surfaced.

## 3. Contract additions

- [x] 3.1 In `package/contract/src/`, export `WIKI_TYPES = ['BOOK', 'GAME', 'MEDIA'] as const` and a matching `WikiType` union; co-locate with the existing Unit type schema.
- [x] 3.2 Add `package/contract/src/realm/realm-extra.ts` defining `RealmExtraSchema` Typebox object: optional `pinboard?: string[]`, optional `announcement?: string[]`, with `additionalProperties: true`. Carry JSDoc comments on each well-known key (English text destined for locale duplication per spec `realm-extra-pinboard-keys`).
- [x] 3.3 Add `package/contract/src/unit/work-link.ts` defining the `PATCH /units/:releaseId/work-link` request/response contracts (input: `{ workUnitId: string | null }`; response: `{ status: 'LINKED' | 'PENDING' | 'UNLINKED'; claimId?: string; autoApproved?: boolean }`).
- [x] 3.4 Add `package/contract/src/unit/work-link-claim.ts` defining the `WorkLinkClaim` shape, list/approve/reject/withdraw endpoint contracts, and the `ClaimStatus` enum mirror.
- [x] 3.5 Add `package/contract/src/unit/translation-source.ts` defining the `PATCH /units/:workId/translations/:lang/source` contract (`{ sourceReleaseUnitId: string | null }`).
- [x] 3.6 Delete `package/contract/src/pinboard.ts` and remove all its re-exports from `package/contract/src/index.ts`.
- [x] 3.7 Re-export new contracts from `package/contract/src/index.ts`; run `bun run --filter @rezics/contract build` (or equivalent type-check) to verify. (Verified via `bunx tsc --noEmit`; only a pre-existing `unitTagDTOSchema` error from the unrelated `tag-pin-and-realm-vote` working-tree change remains.)

## 4. Server: unit authority & work-link

- [x] 4.1 Create `package/server/src/unit/authority.ts` exporting `hasAuthorityOver(caller, unit): Promise<boolean>` per spec `unit-authority`. Use a single indexed JOIN against `RealmUnit` × realm role tables; cache admin role on the access token.
- [ ] 4.2 Add unit tests at `package/server/src/unit/authority.test.ts` covering all four scenarios from the `unit-authority` spec (owner, admin, realm-mod, stranger) plus the null-owner case.
- [x] 4.3 Implement `PATCH /units/:releaseId/work-link` in `package/server/src/unit/unit.api.ts` (or a new `work-link.api.ts` mounted by it). Implement the D5 decision tree: release-side authority required; null clears link and cascades pending claims to `WITHDRAWN`; type/nesting validation; immediate set when caller has work-side authority OR `workUnit.type ∈ WIKI_TYPES`; otherwise create `WorkLinkClaim(PENDING)`.
- [x] 4.4 Move the work-link logic into a new `package/server/src/unit/work-link.service.ts` so the API handler stays thin.
- [ ] 4.5 Add server tests for `PATCH /units/:releaseId/work-link` covering: immediate link by owner, immediate link by realm mod, wiki short-circuit (BOOK/GAME/MEDIA), pending claim creation for POST, unlink cascading PENDING claims to WITHDRAWN, type-mismatch 400, nesting 400, missing release-side authority 403.

## 5. Server: WorkLinkClaim endpoints

- [x] 5.1 Add `package/server/src/unit/work-link-claim.service.ts` with `approve`, `reject`, `withdraw`, `listByWork`, and `dedupeOrCreate` operations per spec `work-link-claim`.
- [x] 5.2 Add `package/server/src/unit/work-link-claim.api.ts` mounting `GET /units/:workUnitId/work-link-claims`, `POST /work-link-claims/:claimId/approve`, `POST /work-link-claims/:claimId/reject`, `DELETE /work-link-claims/:claimId`. Wire authorization via `hasAuthorityOver`.
- [x] 5.3 Mount the new claim API in `package/server/src/index.ts`.
- [x] 5.4 Implement read-time filtering of claims for soft-deleted release Units (`status = DELETED`) per spec scenario "Soft-deleted unit hides claims at read time".
- [ ] 5.5 Add server tests covering: approve happy path (sets `Unit.workUnitId`, marks claim APPROVED, fires notify), approve non-pending → 409, reject sets `rejectReason`, reject leaves `workUnitId` unchanged, withdraw allowed by claimer, withdraw rejected for third party (403), inbox listing ordered by `createdAt desc`, inbox 403 for stranger, hard-delete cascade, soft-delete read-time filter.

## 6. Server: UnitTranslation source endpoint

- [x] 6.1 Add `PATCH /units/:workId/translations/:lang/source` in `package/server/src/unit/translation.api.ts` (or analogous existing module) per spec `unit-translation`. Validate workId is a work (no `workUnitId`), validate `sourceReleaseUnitId` references a release of that work, require `hasAuthorityOver(caller, workUnit)`. Upsert `UnitTranslation` row.
- [ ] 6.2 Add server tests: cross-work source rejected (400), unauthorized caller (403), upsert creates row when none exists, update leaves `title/subtitle/summary/description` untouched.

## 7. Server: Realm extra primitives

- [x] 7.1 Add `package/server/src/realm/realm-extra.api.ts` exposing `POST /realms/:realmId/extra/:key/append`, `POST /realms/:realmId/extra/:key/reorder`, `DELETE /realms/:realmId/extra/:key/:unitId` per spec `realm-extra-pinboard-keys`. Authorize via realm-moderator role OR `hasAuthorityOver(caller, realmUnit)`.
- [x] 7.2 Implement transactional `SELECT ... FOR UPDATE` row lock on the realm row inside each handler to serialize concurrent writes.
- [x] 7.3 Implement read-time stale-ID filtering in the realm read endpoint (or a shared `realm-extra.service.ts`): drop IDs with no Unit, `status = DELETED`, or not visible to the caller. Preserve stored array unchanged.
- [x] 7.4 Provide an admin-side variant returning the unfiltered list with stale markers so moderators can clean up entries.
- [x] 7.5 Mount the new realm-extra API in `package/server/src/index.ts`.
- [ ] 7.6 Add server tests: append idempotent, reorder permutation accepted, reorder non-permutation rejected (400), concurrent appends serialize, deleted unit filtered for non-admin, admin view shows stale entries.

## 8. Server: pinboard backend deletion

- [x] 8.1 Delete `package/server/src/pinboard/` directory.
- [x] 8.2 Remove the pinboard mount from `package/server/src/index.ts`.
- [x] 8.3 Run `rg "pinboard" package/server/src` to confirm no dangling references remain.

## 9. Notify package extension

- [x] 9.1 In `package/notify/`, expose `notifySystemAndEmail({ userId, kind, payload, locale? })` per spec `notify-system-email`. If email transport is missing, add it (templated via the existing email package).
- [x] 9.2 Register notify kinds `WORK_LINK_CLAIM_PENDING`, `WORK_LINK_CLAIM_APPROVED`, `WORK_LINK_CLAIM_REJECTED` in the notify catalog with system-feed renderer + email template per spec.
- [x] 9.3 Implement per-recipient 24h deduplication for `WORK_LINK_CLAIM_PENDING` keyed on `(recipientUserId, payload.claimerUserId, payload.workUnitId)` — duplicates refresh timestamp but suppress email.
- [x] 9.4 Localize each renderer using the existing language fallback chain; ensure all five locales (`en`, `zh-hans`, `zh-hant`, `ja`, `de`) carry strings for the three new kinds.
- [ ] 9.5 Add notify tests covering both-channels-dispatch, email-failure-doesn't-throw, locale fallback, and 24h dedup window.
- [x] 9.6 Wire the new notify call from the work-link claim creation, approve, and reject handlers in `package/server/src/unit/`.

## 10. API package: hooks

- [x] 10.1 In `package/api/`, add query/mutation hooks for `PATCH /units/:releaseId/work-link`, claim approve/reject/withdraw, claim inbox, translation-source patch.
- [x] 10.2 In `package/api/`, add hooks for the realm-extra append/reorder/remove endpoints and the realm-extra read endpoint with stale filtering.
- [x] 10.3 Type-check `@rezics/api` (`bun run --filter @rezics/api typecheck` or equivalent). (Verified via `bunx tsc --noEmit`; only pre-existing errors and the still-present `pinboard/*` directory remain — those will be removed in Phase G.)

## 11. UI: extract translation components to @rezics/ui

- [x] 11.1 Move `package/app/src/i18n/components/TranslationEditor.tsx` into `package/ui/src/translation/TranslationEditor.tsx`. Adjust imports to remove any `@rezics/api` direct imports — accept handlers/data via props.
- [x] 11.2 Move `package/app/src/i18n/components/TranslationTabs.tsx` into `package/ui/src/translation/TranslationTabs.tsx`.
- [x] 11.3 Move `package/app/src/i18n/components/WorkReleaseNav.tsx` into `package/ui/src/translation/WorkReleaseNav.tsx`. Replace its `bookQueries` import with a prop interface `releases: Array<{ unitId: string; title?: string }>` plus a `renderLink` render-prop (typed routing stays in the consuming app).
- [x] 11.4 Re-export the three components from `package/ui/src/index.ts`.
- [x] 11.5 Update existing consumers (book editor, book library, etc.) to import from `@rezics/ui` instead of `@rezics/app/src/i18n/components`. Use `rg "from ['\"].*i18n/components" package/app/src` to find call sites. (Only `BookBasicInfoPage.tsx` consumed `WorkReleaseNav`; updated to use the new render-prop and a local `BookWorkReleaseNav` wrapper that owns the `bookQueries` fetch.)
- [x] 11.6 Delete `package/app/src/i18n/components/` (or the three migrated files specifically) and run a project-wide build to surface any missed imports.
- [x] 11.7 Add a small `deriveTitleSummary(body: string): { title?: string; summary?: string }` helper in `package/ui/src/translation/derive.ts` for reuse across editors per design D8.

## 12. App: pinboard rewrite

- [ ] 12.1 Rewrite `package/app/src/pinboard/` as a thin contract-driven section: editor reads/writes `Realm.extra.pinboard` via the realm-extra hooks; per-Unit editing uses the moved `TranslationEditor` + `WorkReleaseNav` from `@rezics/ui`.
- [ ] 12.2 Compose the announcement editor on the same primitives, gated by realm-mod authority.
- [ ] 12.3 Update the realm admin route to consume the new pinboard section; remove any imports of the old pinboard contract.
- [ ] 12.4 Smoke-test in dev (`bun run app:dev`): create a pinboard entry, reorder it, remove it, soft-delete the underlying Unit and confirm read-time filtering.

## 13. App: locale entries

- [ ] 13.1 Add `realm.extra.pinboard.note` and `realm.extra.announcement.note` entries to each of `package/app/src/locale/{en,zh-hans,zh-hant,ja,de}.ts`. The English value SHALL match the JSDoc verbatim per spec.
- [ ] 13.2 Add the three new notify kind labels (`WORK_LINK_CLAIM_PENDING/APPROVED/REJECTED`) to all five locale files.
- [ ] 13.3 Add UI strings for the WorkLinkClaim inbox + claim approval modal in all five locale files.

## 14. Seed data

- [ ] 14.1 Update or replace `package/server/prisma/seed/mocks/pinboard.ts` to populate the new shape: write to `Realm.extra.pinboard` directly, ensuring the referenced Units exist and carry `UnitTranslation.sourceReleaseUnitId` values.
- [ ] 14.2 Run `bun run --filter @rezics/server prisma:seed` (or equivalent) and verify the realm admin page renders pinboard entries via the new primitives.

## 15. Convention & cross-cutting checks

- [ ] 15.1 Run `bun run check:convention` and resolve any new violations (route convention, SafeLink rule for any new outbound links).
- [ ] 15.2 Run `bun run knip` at the repo root and clean up unused exports introduced by the deletions.
- [ ] 15.3 Type-check the whole monorepo (`bun run --filter '*' typecheck` or `bun x tsc -b`) to verify the contract removals do not leave dangling imports.
- [ ] 15.4 Run all package test suites (`bun test` in each affected package) and fix regressions.

## 16. Wrap-up

- [ ] 16.1 Manual QA: run `bun run dev`; verify (a) pinboard CRUD via the new primitives; (b) creating a POST Release and linking it to a Work owned by the same user (immediate LINKED); (c) creating a POST Release and linking it to a Work owned by another user (PENDING claim + email + in-app notification); (d) approving a claim from the work-side inbox; (e) rejecting a claim with a reason; (f) withdrawing a claim as the claimer; (g) BOOK release auto-link via wiki short-circuit.
- [ ] 16.2 Run `openspec validate unit-work-release-i18n` and confirm no errors.
- [ ] 16.3 Open the PR; reference this change's `proposal.md`. Do not archive yet — archival happens after merge via `/opsx:archive unit-work-release-i18n`.
