# @rezics/shared

Cross-package primitives that have no domain or runtime allegiance. Anything that
both backend seed/factory code and frontend story fixtures legitimately need
should live here — kept small, pure, and free of Prisma / React dependencies.

## Entry points

- `@rezics/shared/random` — `randomInt`, `randomBoolean`, `randomFloat`, `pickN`,
  `powerLaw`, `createUsernameGenerator`. Pure functions over `@faker-js/faker`.
- `@rezics/shared/text` — `getFaker(lang)`, `LANG_DISTRIBUTION`, `generateTitle`,
  `generateParagraph`, plus re-exports of the corpus accessors below.
- `@rezics/shared/text/corpus` — curated multilingual title / summary / description
  pools (`getTitlePool`, `getSummaryPool`, `getDescriptionPool`).

## Out of scope

- Prisma-coupled generators (anything referencing `UnitType` / `PostKind` /
  `Prisma.InputJsonValue`) stay in `package/server/prisma/factory/`.
- Storybook intentful fixtures (`bookEmpty`, `bookLongTitle`, `bookCJK`, …) stay
  in `package/app/src/stories/fixtures/`; they may import the primitives above
  for locale-aware string generation.
