## 1. Contract (`package/contract`)

- [ ] 1.1 Create `src/pinboard.ts`: export `PINBOARD_KEYS = ["announcement", "pinned"] as const`, `pinboardKeySchema` Typebox union, DTO schemas for `PinboardEntryDTO` (list-level) and `PinboardEntryDetailDTO` (detail-level), request schemas (`createPinboardEntryBody`, `updatePinboardEntryBody`, `pinBody`, `reorderBody`, common `pinboardPathParams`), and response schemas for all endpoints.
- [ ] 1.2 In `src/realm.ts`: add `realmExtraSchema` with `announcementPostIds?`, `pinnedPostIds?`, `filterTagIds?` (all `t.Optional(t.Array(t.String()))`), permissive to unknown keys; wire it into `realmDTOSchema.extra` replacing the previous `t.Any()` typing.
- [ ] 1.3 Export `pinboard.ts` from `src/index.ts` alongside realm exports; re-export `PINBOARD_KEYS`, `PinboardKey`, and DTO types.
- [ ] 1.4 Run `bun run --filter @rezics/contract build` and fix any downstream type errors exposed by the `Realm.extra` retyping (casts become unnecessary — remove them).

## 2. Server — Pinboard service + API (`package/server/src/pinboard/`)

- [ ] 2.1 Scaffold `pinboard/` with `pinboard.api.ts`, `pinboard.service.ts`, `pinboard.mapper.ts`, `pinboard.types.ts`, and `index.ts`. Mount `pinboardApi` in `src/index.ts`.
- [ ] 2.2 Implement `readList({ realmUnitId, pinboardKey, language, adminView })`: load `Realm.extra`, fetch referenced units with translations in one query, filter soft-deleted/missing, resolve per-entry language using the existing fallback rules (mirroring `TranslationService.resolveTranslation`), return live entries + `staleIds` only for `adminView`.
- [ ] 2.3 Implement `readDetail({ realmUnitId, pinboardKey, unitId, language })`: verify id is in the pinboard, resolve sibling via TranslationGroup supportedLanguages + fallback, return body + supportedLanguages.
- [ ] 2.4 Implement `createPinboardEntry` as one Prisma `$transaction`: create root Unit+Post+UnitTranslation, create TranslationGroup + siblings only when multilingual, `SELECT ... FOR UPDATE` on `Realm`, append to `extra.<pinboardKey>PostIds`. Leave a `// TODO(pinboard-occ):` comment on the locking site.
- [ ] 2.5 Implement `updatePinboardEntry` as one Prisma `$transaction`: upsert UnitTranslation rows, update sibling Post.body where supplied, add/remove sibling languages, enforce default-language protection, keep `TranslationGroup.supportedLanguages` in sync (reusing `translationGroupService.onUnitDeleted(tx, ...)` for sibling soft-deletes).
- [ ] 2.6 Implement `deletePinboardEntry` as one Prisma `$transaction`: soft-delete root + siblings, remove id from `extra.<pinboardKey>PostIds`, delete empty TranslationGroup.
- [ ] 2.7 Implement `pinToPinboard`, `unpinFromPinboard`, `reorderPinboard` with row-level locking on `Realm`; reorder rejects non-permutation with 409.
- [ ] 2.8 Implement permission guard (`requirePinboardWriter`) that accepts realm owner/moderator or global admin/root; apply to every write route. Reuse existing `authMacro`, role helpers, and `RealmMember` lookup.
- [ ] 2.9 Define Elysia routes in `pinboard.api.ts`: `GET /realms/:realmUnitId/pinboards/:pinboardKey`, `GET /realms/:realmUnitId/pinboards/:pinboardKey/:unitId`, `POST /realms/:realmUnitId/pinboards/:pinboardKey`, `PATCH /realms/:realmUnitId/pinboards/:pinboardKey/:unitId`, `DELETE /realms/:realmUnitId/pinboards/:pinboardKey/:unitId`, `POST /realms/:realmUnitId/pinboards/:pinboardKey/:unitId/pin`, `POST /realms/:realmUnitId/pinboards/:pinboardKey/:unitId/unpin`, `POST /realms/:realmUnitId/pinboards/:pinboardKey/reorder`.
- [ ] 2.10 Add Meilisearch sync hooks: after composite writes, call the existing `patchPostsTargetToMeili(unitId)` / `syncPostToMeili(unitId)` helpers fire-and-forget for the affected unit ids; do not block the tx.
- [ ] 2.11 Add unit tests in `src/pinboard/__tests__/`: stale-id filtering, language fallback, unique append semantics, reorder-permutation rejection, default-language protection, soft-delete removing id from extra, permission denial paths.
- [ ] 2.12 Run `bun run --filter @rezics/server build` and the pinboard test file (`bun test src/pinboard`). Verify `bun run check:convention` still passes for added routes.

## 3. Server — Seed (`package/server/prisma/seed`)

- [ ] 3.1 Remove the EchoKV `home_notice` seed fixture (keep other EchoKV fixtures).
- [ ] 3.2 Add a seed step that, after `default-realm` is bootstrapped, creates 2–3 sample multilingual announcements via the pinboard service (using the root user as author) and appends them to `default-realm.extra.announcementPostIds`. Include at least one entry with `zh-Hans + en + ja` and one single-language entry to exercise both paths.
- [ ] 3.3 Run `bun run --filter @rezics/server prisma:reset` (or equivalent dev-only reset) locally and confirm the homepage renders non-empty announcements after the reseed.

## 4. Frontend API (`package/api/src/pinboard/`)

- [ ] 4.1 Scaffold `pinboard/` with `query-options.ts` and `hooks.ts`. Export via the package entry point.
- [ ] 4.2 Add `pinboardListQueryOptions({ realmSlugOrId, pinboardKey, language, adminView })` and `pinboardDetailQueryOptions({ ..., unitId })` using the shared fetcher and TanStack Query key conventions in this repo.
- [ ] 4.3 Add mutation hooks: `useCreatePinboardEntry`, `useUpdatePinboardEntry`, `useDeletePinboardEntry`, `usePinToPinboard`, `useUnpinFromPinboard`, `useReorderPinboard`. Each SHALL invalidate the relevant list/detail query on success and support optimistic updates for reorder/pin/unpin with rollback on error.
- [ ] 4.4 Run `bun run --filter @rezics/api build`.

## 5. Frontend feature — Pinboard (`package/app/src/pinboard/`)

- [ ] 5.1 Scaffold the feature folder per `package/app/docs/feature standard.md`: `models/`, `hooks/`, `states/`, `components/`, `sections/`, `pages/` (none needed initially), `index.ts`. `models/` SHALL stay free of React imports.
- [ ] 5.2 `models/types.ts`: re-export contract DTOs; define view-model types for the admin editor (per-language draft fields + dirty flag).
- [ ] 5.3 `hooks/usePinboard.ts`: thin adapters over `@rezics/api` query hooks that normalize language + adminView inputs and expose `staleIds`.
- [ ] 5.4 `states/editorDraftAtom.ts` (Jotai): per-(realm, pinboardKey, unitId?) editor draft with dirty tracking for unsaved-change guards.
- [ ] 5.5 `components/PinboardEntryCard.tsx`: shared presentation used by the homepage bar, notice board, and realm feed. Variants: `compact` (bar), `card` (board/feed), `adminRow` (manage list).
- [ ] 5.6 `components/PinboardEmptyState.tsx`, `components/PinboardSkeleton.tsx`, `components/PinboardErrorState.tsx`: skeleton heights MUST match the real row heights to avoid layout shift; error state includes a "Retry" button bound to the query `refetch`.
- [ ] 5.7 `components/LanguageTabs.tsx`: per-language editing tabs with "add language" / "remove language" affordances; default-language tab is non-removable and visually marked.
- [ ] 5.8 `components/PinboardEditorDialog.tsx`: the composite create/edit modal. Uses `LanguageTabs`; each tab holds title/summary/body fields with inline validation; Save invokes the composite API. Integrates the unsaved-change confirm-modal guard.
- [ ] 5.9 `components/PinboardReorderList.tsx`: dnd-kit based sortable list with keyboard drag support. On drop calls `useReorderPinboard`; handles 409 by refetching and showing a non-blocking toast.
- [ ] 5.10 `components/StaleIdsBanner.tsx`: dismissible banner rendered when `staleIds.length > 0`, with a "Clean up" action that iterates `useUnpinFromPinboard` for each stale id.
- [ ] 5.11 `sections/PinboardAdminSection.tsx`: the tabbed admin surface (one tab per pinboard key visible to the caller). Decides which tabs to render based on the target realm (always `pinned`; add `announcement` only for `default-realm`). Wires create / edit / delete / reorder / pin / unpin / cleanup.
- [ ] 5.12 `sections/PinnedFeedSection.tsx`: renders the pinned region above the generic realm feed. Gracefully no-ops when the list is empty.
- [ ] 5.13 `sections/AnnouncementFeedSection.tsx` (homepage): language-resolved announcement list consumed by the homepage bar / notice board. Exposes the entries as a shape the existing `AnnouncementBar` can consume after the migration in section 6.
- [ ] 5.14 `index.ts`: export only the sections + `PinboardEntryCard` public shape; nothing from `models/`, `hooks/`, `states/`, or internal `components/*`.
- [ ] 5.15 Accessibility pass: every interactive control has a visible focus ring, every tab/list/modal uses proper ARIA roles and labels, and the dnd-kit list supports keyboard drag. Verify with keyboard-only navigation.

## 6. Frontend migration — Homepage & Realm pages

- [ ] 6.1 `home/sections/AnnouncementBarSection.tsx`: replace the `echoKvGetQuery("home_notice")` call with `pinboardListQueryOptions({ realmSlugOrId: "rezics", pinboardKey: "announcement", language: currentLanguage })`. Map results into the existing `AnnouncementBar` item shape without subtype tags. Delete tag-chip-related props.
- [ ] 6.2 `home/components/AnnouncementBar.tsx`: remove the `tag` field from the item interface and its rendering; remove any tag-chip styling. Keep pin badges.
- [ ] 6.3 `home/sections/NoticeBoard.tsx`: replace EchoKV reads with the new pinboard source; drop the `公告 / 活动 / 更新` chip system; add a polished empty/loading/error state.
- [ ] 6.4 Delete any remaining `home_notice` references in the app package (`grep -r "home_notice" package/app`). Leave other EchoKV usages (`home_carousel`, admin tooling) untouched.
- [ ] 6.5 Realm detail `Feed` tab: mount `<PinnedFeedSection realmUnitId={...} />` above the existing generic feed component.
- [ ] 6.6 Realm manage page: mount `<PinboardAdminSection realmUnitId={...} isDefaultRealm={...} />` in the page layout below existing realm metadata sections. Gate its visibility using existing manage-permission selectors (realm owner/mod OR global admin/root).
- [ ] 6.7 Verify the default-realm manage page shows both `Announcement` and `Pinned` tabs; verify a non-default realm shows only `Pinned`.
- [ ] 6.8 Run the app locally (`bun run app:dev`), exercise the golden paths (create multilingual announcement as global admin, language switch, reorder via drag, reorder via keyboard, unpin, delete, 409 conflict by simulating concurrent edit, stale-id banner after deleting an underlying post), and confirm each empty/loading/error state renders as designed. Note: this is a manual verification step — record findings in the PR description.

## 7. Frontend migration — hygiene & mocks

- [ ] 7.1 Remove or update any `// MOCK:` annotations in `home/` that were placeholders for announcement data now delivered by the real API.
- [ ] 7.2 Grep the app package for the three dropped subtype-tag literals (`公告`, `活动`, `更新`) in announcement-related code and remove dead code paths.

## 8. Spec deltas & convention checks

- [ ] 8.1 Verify `openspec validate realm-pinboard` (or the repo's equivalent check) parses the proposal, design, and all five spec files.
- [ ] 8.2 Run `bun run check:convention` at the repo root to ensure the new routes match the API route convention and no new raw `<a href>` links were introduced (`SafeLink` only).
- [ ] 8.3 Run `bun run knip` at the repo root and clean up any newly reported unused exports introduced by the change.

## 9. Final verification

- [ ] 9.1 `bun run --filter @rezics/contract build`, `bun run --filter @rezics/server build`, `bun run --filter @rezics/api build`, `bun run --filter @rezics/app build` — all green.
- [ ] 9.2 Run all new backend tests (`bun test src/pinboard` in `package/server`).
- [ ] 9.3 Manual frontend smoke test checklist captured in PR description: create / edit / reorder / pin / unpin / delete / language switch / stale-id cleanup / permission gating for member vs. mod vs. global admin.
- [ ] 9.4 Deploy order note in PR description: ship contract + server first, then frontend; document the brief window where the homepage may show an empty announcement bar between deployments.
