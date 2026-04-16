## 1. Contract: Default Realm Definition

- [x] 1.1 Add `DEFAULT_REALM` constant object to `package/contract/src/realm.ts` with slug, flags, and translations (en, zh-hant, ja) — all fields documented with JSDoc
- [x] 1.2 Export `DefaultRealmDefinition` type (`typeof DEFAULT_REALM`) from `package/contract/src/realm.ts`
- [x] 1.3 Re-export new symbols from `package/contract/src/index.ts`
- [x] 1.4 Verify `bun run build` (or `tsc --noEmit`) passes in `package/contract`

## 2. Seed: Import from Contract

- [x] 2.1 Update `tool/seed/lib/seed-infra.ts` `seedDefaultRealm` to import `DEFAULT_REALM` from `@rezics/contract` and iterate over `DEFAULT_REALM.translations` to create `UnitTranslation` and `UnitSupportLanguage` rows for all 3 languages
- [x] 2.2 Remove hardcoded translation strings from `seedDefaultRealm`
- [x] 2.3 Verify seed is idempotent — run twice against a test database and confirm no duplicate translations or errors

## 3. Server: Boot-time Default Realm Cache

- [x] 3.1 Create `package/server/src/infra/default-realm.ts` exporting `initDefaultRealmCache(): Promise<void>` and `getDefaultRealmId(): string | null`
- [x] 3.2 `initDefaultRealmCache` reads `infra:default_realm` from EchoKV via Prisma, caches the ID. Logs a warning if key is missing
- [x] 3.3 Call `initDefaultRealmCache()` in server startup (`package/server/src/index.ts`) before the server starts listening
- [x] 3.4 Verify server starts cleanly with and without the EchoKV key present

## 4. Server: Auto-Join on Provisioning

- [x] 4.1 In `package/server/src/internal/internal.api.ts`, after the `prisma.user.upsert` call, add a fire-and-forget call to join the user to the default realm using `getDefaultRealmId()`
- [x] 4.2 Skip the join if `getDefaultRealmId()` returns `null`; catch and log all errors (including duplicate membership)
- [x] 4.3 Update `package/server/src/internal/internal.api.test.ts` to cover: new user joins default realm, existing user silently skips, null realm ID skips

## 5. Frontend: Infra Bootstrap and localStorage Cache

- [x] 5.1 Create an infra bootstrap utility (in `package/app/src/app/` or `package/api/`) that fetches `infra:default_realm` from EchoKV and persists the ID to `localStorage` under key `rezics:infra:default_realm_id`
- [x] 5.2 Integrate the bootstrap into `package/app/src/app/provider/useAppInit.ts` (or a dedicated `useInfraBootstrap` hook called from there)
- [x] 5.3 Create a synchronous accessor `getDefaultRealmId(): string | null` that reads from `localStorage` with TanStack Query cache fallback
- [x] 5.4 Wire the accessor into any existing scoring form/submission that needs the default realm ID

## 6. Validation

- [x] 6.1 Run `bun run build` across affected packages (`contract`, `server`, `app`) — no type errors
- [x] 6.2 Run `bun test` in `package/server` — all tests pass including new provisioning tests
- [x] 6.3 Manual test: seed a fresh database, start server, register a new user, confirm they appear in `RealmMember` for the default realm
