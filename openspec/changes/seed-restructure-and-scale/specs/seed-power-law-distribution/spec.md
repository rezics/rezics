## ADDED Requirements

### Requirement: Power-law distribution utility function

The seed system SHALL provide a `powerLaw(min: number, max: number, alpha: number): number` function in the shared utils module. This function SHALL return an integer drawn from a Pareto-like distribution where most values cluster near `min` and extreme values near `max` occur with low probability.

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

### Requirement: Power-law applied to reviews per work

The number of reviews seeded per work SHALL be determined by `powerLaw(0, 50, 1.8)` instead of a fixed count. Most works SHALL receive 0–2 reviews, with rare works receiving up to 50.

#### Scenario: Typical work gets minimal reviews

- **WHEN** 1000 works are seeded
- **THEN** at least 70% of works SHALL have 2 or fewer reviews

#### Scenario: Popular work gets many reviews

- **WHEN** 1000 works are seeded
- **THEN** at least 1 work SHALL have 20 or more reviews

### Requirement: Power-law applied to posts per work

The number of tree posts seeded per work SHALL be determined by `powerLaw(0, 120, 1.8)`. Most works SHALL receive 0–3 posts, with rare works receiving up to 120.

#### Scenario: Most works have few posts

- **WHEN** 1000 works are seeded
- **THEN** at least 70% of works SHALL have 3 or fewer tree posts

### Requirement: Power-law applied to chapters per book

The total chapter count per book SHALL be determined by `powerLaw(5, 1200, 2.0)`. Most books SHALL have 5–30 chapters, with rare mega-books having 500–1200 chapters.

#### Scenario: Typical book has modest chapter count

- **WHEN** 1000 books are seeded
- **THEN** at least 70% of books SHALL have 30 or fewer chapters

#### Scenario: Mega-book exists

- **WHEN** 1000 books are seeded
- **THEN** at least 1 book SHALL have 200 or more chapters

### Requirement: Power-law applied to shelf item count

The number of items per shelf SHALL be determined by `powerLaw(3, 150, 1.5)`. Most shelves SHALL contain 3–8 items, with rare large collections containing up to 150.

#### Scenario: Typical shelf is small

- **WHEN** 500 shelves are seeded
- **THEN** at least 60% of shelves SHALL have 8 or fewer items

#### Scenario: Large collection shelf exists

- **WHEN** 500 shelves are seeded
- **THEN** at least 1 shelf SHALL have 50 or more items

### Requirement: Power-law applied to quotes and remarks per work

Quotes per work SHALL use `powerLaw(0, 15, 2.0)` and remarks per work SHALL use `powerLaw(0, 10, 2.0)`.

#### Scenario: Most works have few quotes

- **WHEN** 1000 works are seeded
- **THEN** at least 80% of works SHALL have 1 or fewer quotes
