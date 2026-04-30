## MODIFIED Requirements

### Requirement: Power-law distribution utility function

The seed system SHALL provide a `powerLaw(min: number, max: number, alpha: number): number` function in the shared utils module. This function SHALL return an integer drawn from a Pareto-like distribution where most values cluster near `min` and extreme values near `max` occur with low probability. This primitive SHALL be used by the `CountProvider` when `mode === 'realistic'`; seeder call sites SHALL NOT invoke it directly.

#### Scenario: Values stay within bounds

- **WHEN** `powerLaw(0, 50, 1.8)` is called 10000 times
- **THEN** every returned value SHALL be >= 0 and <= 50

#### Scenario: Distribution skews toward minimum

- **WHEN** `powerLaw(0, 50, 1.8)` is called 10000 times
- **THEN** at least 70% of values SHALL be <= 5 (near the minimum)

#### Scenario: Extreme values occur rarely

- **WHEN** `powerLaw(0, 50, 1.8)` is called 10000 times
- **THEN** at least 1 value SHALL be >= 30 (extreme outlier exists)
- **AND** fewer than 5% of values SHALL be >= 30

#### Scenario: Seeder call sites do not import powerLaw directly

- **WHEN** any file under `package/server/prisma/factory/` except the `CountProvider` implementation and the utils module is inspected
- **THEN** it SHALL NOT import `powerLaw`
- **AND** its count decisions SHALL go through `ctx.draw(...)`

### Requirement: Power-law applied to reviews per work

When `mode === 'realistic'`, the number of reviews seeded per work SHALL be determined by `ctx.draw(plan.postsPerWork.review)` where `plan.postsPerWork.review` is a `CountSpec` whose realistic-preset default is `{ min: 0, max: 50, alpha: 1.8 }`. Under other modes, the same call site SHALL return counts according to the active mode's interpretation of that spec. Most works SHALL receive 0–2 reviews under realistic mode, with rare works receiving up to 50.

#### Scenario: Typical work gets minimal reviews under realistic mode

- **WHEN** 1000 works are seeded with the realistic preset
- **THEN** at least 70% of works SHALL have 2 or fewer reviews

#### Scenario: Popular work gets many reviews under realistic mode

- **WHEN** 1000 works are seeded with the realistic preset
- **THEN** at least 1 work SHALL have 20 or more reviews

#### Scenario: Fixed mode produces a constant per-work review count

- **WHEN** 100 works are seeded with a preset where `mode = 'fixed'` and `plan.postsPerWork.review = { min: 0, max: 50, target: 3 }`
- **THEN** every work SHALL have exactly 3 reviews

### Requirement: Power-law applied to posts per work

When `mode === 'realistic'`, the number of tree posts seeded per work SHALL be determined by `ctx.draw(plan.postsPerWork.tree)` where the realistic-preset default is `{ min: 0, max: 120, alpha: 1.8 }`. Most works SHALL receive 0–3 posts under realistic mode, with rare works receiving up to 120.

#### Scenario: Most works have few posts under realistic mode

- **WHEN** 1000 works are seeded with the realistic preset
- **THEN** at least 70% of works SHALL have 3 or fewer tree posts

#### Scenario: Fixed mode produces a constant per-work tree-post count

- **WHEN** 100 works are seeded with a preset where `mode = 'fixed'` and `plan.postsPerWork.tree = { min: 0, max: 120, target: 10 }`
- **THEN** every work SHALL have exactly 10 tree posts

### Requirement: Power-law applied to chapters per book

When `mode === 'realistic'`, the total chapter count per book SHALL be determined by `ctx.draw(plan.chapter.count)` where the realistic-preset default is `{ min: 5, max: 1200, alpha: 2.0 }`. Most books SHALL have 5–30 chapters under realistic mode, with rare mega-books having 500–1200 chapters.

#### Scenario: Typical book has modest chapter count under realistic mode

- **WHEN** 1000 books are seeded with the realistic preset
- **THEN** at least 70% of books SHALL have 30 or fewer chapters

#### Scenario: Mega-book exists under realistic mode

- **WHEN** 1000 books are seeded with the realistic preset
- **THEN** at least 1 book SHALL have 200 or more chapters

#### Scenario: Fixed mode produces the same chapter count per book

- **WHEN** 100 books are seeded with a preset where `mode = 'fixed'` and `plan.chapter.count = { min: 5, max: 1200, target: 5 }`
- **THEN** every book SHALL have exactly 5 chapters

### Requirement: Power-law applied to shelf item count

When `mode === 'realistic'`, the number of items per shelf SHALL be determined by `ctx.draw(plan.shelfItemCount)` where the realistic-preset default is `{ min: 3, max: 150, alpha: 1.5 }`. Most shelves SHALL contain 3–8 items under realistic mode, with rare large collections containing up to 150.

#### Scenario: Typical shelf is small under realistic mode

- **WHEN** 500 shelves are seeded with the realistic preset
- **THEN** at least 60% of shelves SHALL have 8 or fewer items

#### Scenario: Large collection shelf exists under realistic mode

- **WHEN** 500 shelves are seeded with the realistic preset
- **THEN** at least 1 shelf SHALL have 50 or more items

### Requirement: Power-law applied to quotes and remarks per work

When `mode === 'realistic'`, quotes per work SHALL use `ctx.draw(plan.postsPerWork.excerpt)` with realistic-preset default `{ min: 0, max: 15, alpha: 2.0 }`, and remarks per work SHALL use `ctx.draw(plan.postsPerWork.remark)` with realistic-preset default `{ min: 0, max: 10, alpha: 2.0 }`.

#### Scenario: Most works have few quotes under realistic mode

- **WHEN** 1000 works are seeded with the realistic preset
- **THEN** at least 80% of works SHALL have 1 or fewer quotes
