## 1. Backend: membership-me endpoint

- [ ] 1.1 Add `GET /realms/:unitId/members/me` endpoint in `package/server/src/realm/realm.api.ts` — requires auth, calls `realmService.getMember(unitId, identity.unitId)`, returns `RealmMemberDTO | null`

## 2. API client: membership hook

- [ ] 2.1 Add `getMyMembership(realmId)` API function in `package/api/src/realm/realm.api.ts`
- [ ] 2.2 Add `myRealmMembershipQuery(realmId)` query options in `package/api/src/realm/realm.queries.ts` (5 min stale time)
- [ ] 2.3 Export `myRealmMembershipQuery` from `package/api/src/realm/realm.ts`

## 3. Frontend: canManageRealm utility

- [ ] 3.1 Create `canManageRealm` utility function in `package/app/src/realm/` — accepts `{ globalRole, memberRoleKey }`, returns `true` if globalRole is ADMIN/ROOT or memberRoleKey is owner/admin/moderator

## 4. Frontend: manage icon on RealmPage

- [ ] 4.1 In `package/app/src/realm/page/RealmPage.tsx`: query `myRealmMembershipQuery(realmId)` and get global role from auth session store
- [ ] 4.2 Add a MUI settings/tune `IconButton` in the header row (next to realm title, before JoinButton) that links to `/realm/${realmId}/manage`
- [ ] 4.3 Conditionally render the icon only when `canManageRealm` returns true

## 5. Frontend: RealmManagePage permission guard and translation fix

- [ ] 5.1 In `package/app/src/realm/page/RealmManagePage.tsx`: add permission guard using `canManageRealm` — redirect to `/realm/${realmId}` if unauthorized
- [ ] 5.2 Fix translation update: instead of sending `translations` inside the realm update mutation, call the unit translation upsert endpoint separately for title/description changes
- [ ] 5.3 Keep realm-specific fields (isPublic, isOfficial, extra) in the realm update mutation

## 6. Seed: verify realm translations

- [ ] 6.1 Review `package/server/prisma/seed/mock/generators.ts` `generateTranslations(UnitType.REALM)` — ensure title is always non-null and non-empty
- [ ] 6.2 Review `package/server/prisma/seed/mock/realms.ts` — ensure translations are created correctly
- [ ] 6.3 If fix is needed, update the generator to guarantee a non-empty title for realms
- [ ] 6.4 Run seed, query a realm via API, verify `unit.translations` contains entries with non-null titles

## 7. Verify

- [ ] 7.1 Run `tsc --noEmit` for `package/server`, `package/api`, `package/app` — zero errors
- [ ] 7.2 Verify manage icon: log in as admin user → navigate to any realm → confirm settings icon visible → click → lands on manage page
- [ ] 7.3 Verify manage icon hidden: log in as regular non-member user → navigate to realm → confirm no settings icon
- [ ] 7.4 Verify permission guard: as non-admin non-member, navigate directly to `/realm/<id>/manage` → confirm redirect to realm detail
- [ ] 7.5 Verify translation save: edit realm title on manage page → save → reload → confirm title persisted
- [ ] 7.6 Verify seed: run fresh seed → navigate to realms → confirm none show "Untitled Realm"
