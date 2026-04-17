## 1. Prisma schema & migration

- [ ] 1.1 Add `TranslationGroup` model to `package/server/prisma/schema.prisma` with `id` (uuidv7), `supportedLanguages` (`String[]`, `@db.VarChar(16)`), `createdAt`, and `units Unit[]` relation.
- [ ] 1.2 Add `translationGroupId String? @db.Uuid` and `translationGroup TranslationGroup? @relation(..., onDelete: SetNull)` on `Unit`.
- [ ] 1.3 Add `@@unique([translationGroupId, defaultLanguage])` and `@@index([translationGroupId])` on `Unit`.
- [ ] 1.4 Add `///` Prisma doc comment on `Unit.isLanguageNeutral` describing its purpose (language-independent units like TAG; bypasses `UnitSupportLanguage`).
- [ ] 1.5 Run `bun run prisma:migrate` in `package/server` to generate the migration.
- [ ] 1.6 Edit the generated SQL migration to replace the full index on `Unit(translationGroupId)` with a partial index `WHERE "translationGroupId" IS NOT NULL`; add an inline comment in the SQL explaining why.
- [ ] 1.7 Run `bun run prisma:generate` and verify the client compiles.

## 2. Server domain: translation-group service

- [ ] 2.1 Create `package/server/src/translation-group/` folder with `translation-group.service.ts`, `translation-group.mapper.ts`, `translation-group.types.ts`.
- [ ] 2.2 Implement `attachTranslation(existingUnitId, newUnitInput)` in the service: in one transaction, create the new Unit + its `UnitSupportLanguage` row, create the `TranslationGroup` if the existing unit has none, back-fill the existing unit's `translationGroupId`, set the new unit's `translationGroupId`, and update `supportedLanguages`.
- [ ] 2.3 Implement `detachTranslation(unitId)`: clear `Unit.translationGroupId`, remove the language from `TranslationGroup.supportedLanguages`, delete the group if it becomes empty. All in one transaction.
- [ ] 2.4 Implement `listGroupSiblings(unitId)` returning sibling Units with `{ id, defaultLanguage, translationSnippet }` and `supportedLanguages` from the group row.
- [ ] 2.5 Implement `getSupportedLanguages(unitId)` as a single PK-style lookup via `TranslationGroup.id`.
- [ ] 2.6 Add a `reconcileSupportedLanguages()` maintenance method that recomputes every group's `supportedLanguages` from its members. Not exposed to the API; wire as a CLI script under `package/server/scripts/`.

## 3. Server API: Elysia routes

- [ ] 3.1 In `package/server/src/translation-group/translation-group.api.ts`, define routes: `POST /unit/:unitId/translations` (attach), `DELETE /unit/:unitId/translation-group` (detach), `GET /unit/:unitId/translations` (list siblings + supportedLanguages).
- [ ] 3.2 Mount the new router in `package/server/src/index.ts` via `.use()`.
- [ ] 3.3 Validate that only POST Units can participate: reject attach attempts on non-POST Units with a 400 error at the service boundary.
- [ ] 3.4 Ensure the attach route verifies `defaultLanguage` is a canonical code (reuse `languageSchema`).
- [ ] 3.5 Write integration tests covering: first attach (creates group), subsequent attach, duplicate-language rejection, detach, detach-last-member (group removed), non-POST rejection.

## 4. Contract schemas

- [ ] 4.1 Add `translationGroupSchema`, `attachTranslationSchema`, `translationGroupSiblingsSchema` in `package/contract/src/unit.ts` (or new `translation-group.ts` if preferred; follow existing domain layout).
- [ ] 4.2 Re-export new types from the package entry point.
- [ ] 4.3 Run `tsc --noEmit` in `package/contract` and confirm no errors.

## 5. Frontend API hooks

- [ ] 5.1 Add TanStack Query hooks in `package/api/src/unit/` (or a new `translation-group/` subfolder): `useAttachTranslation`, `useDetachTranslation`, `useTranslationGroupSiblings`.
- [ ] 5.2 Wire query keys through the existing key-factory pattern used by other unit hooks.
- [ ] 5.3 Run `tsc --noEmit` in `package/api` and confirm no errors.

## 6. Frontend UI: post detail language switcher

- [ ] 6.1 In `package/app/src/<post-feature>/component/`, add a `PostLanguageSwitcher` component that accepts `{ siblings, supportedLanguages, currentLanguage }` and renders language options (MUI-first per project UI conventions).
- [ ] 6.2 In the post detail section, fetch siblings via `useTranslationGroupSiblings` when `translationGroupId` is present on the post; hide the switcher entirely when not.
- [ ] 6.3 Clicking a sibling language navigates to that sibling post's route.
- [ ] 6.4 Add a "Add translation" action visible to users with appropriate permission; wire it to `useAttachTranslation`. If backend permissions aren't finalized, guard with a `// MOCK:` comment-flagged placeholder.
- [ ] 6.5 Verify the feature visually in the dev server (`bun run dev`) for: standalone post (no switcher), 2-language group, 3-language group.

## 7. Seed data

- [ ] 7.1 In `package/server/prisma/seed/mock/posts.ts`, seed at least one wiki POST group with 3 languages (`zh-hant`, `en`, `ja`). Use deterministic uuidv7 seeds following existing seed conventions.
- [ ] 7.2 Ensure each seeded post gets its own `UnitSupportLanguage(self, defaultLanguage, isPrimary = true)` row.
- [ ] 7.3 Add a `// MOCK:` comment on the seeded bodies where applicable.

## 8. Spec finalization

- [ ] 8.1 Verify `openspec/changes/post-parallel-translation-group/specs/post-parallel-translation/spec.md` is complete.
- [ ] 8.2 Verify `openspec/changes/post-parallel-translation-group/specs/unit-translation/spec.md` delta correctly modifies the existing requirement.
- [ ] 8.3 Run `openspec validate post-parallel-translation-group` and resolve any reported issues.

## 9. Verification

- [ ] 9.1 Run `bun test` in `package/server`.
- [ ] 9.2 Run `tsc --noEmit` independently in each of `package/server`, `package/contract`, `package/api`, `package/app` (per project convention: cross-package path-alias errors can be ignored).
- [ ] 9.3 Manual smoke test via dev server: create a POST, attach a second-language translation, detach, delete a post and verify group cleanup.
- [ ] 9.4 Check `git grep -n "sourceReleaseUnitId"` across the repo; confirm no POST-related code paths reference it.
