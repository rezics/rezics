# list-empty-state Specification

## Purpose

Defines the `<EmptyState>` primitive (`@rezics/ui/composite/feedback/EmptyState.tsx`) and its application across `@rezics/app` list views. Every settled, length-zero list view renders `<EmptyState>` instead of an empty container; per-card fallbacks remain distinct. Empty-state copy passes through i18n.

## Requirements

### Requirement: Lists render EmptyState when settled and empty

Every user-facing list view SHALL render `EmptyState` when the underlying query is settled (`!isLoading && !error`) and the rendered collection length is zero. A list view SHALL NOT render an empty container or a blank region in this case. Loading and error states remain the caller's responsibility and SHALL NOT be rendered by `EmptyState`.

#### Scenario: Remark list with no remarks
- **GIVEN** a book with zero remarks
- **WHEN** the remark list component is rendered with a settled query and `posts.length === 0`
- **THEN** the list SHALL render `<EmptyState title={t("remark.list.empty.title")} …/>` instead of an empty `<Stack>`

#### Scenario: Excerpt list with no excerpts
- **GIVEN** a book or search scope with zero excerpts
- **WHEN** the excerpt list component is rendered with a settled query and `units.length === 0`
- **THEN** the list SHALL render `<EmptyState title={t("excerpt.list.empty.title")} …/>`

#### Scenario: Review search with zero results
- **WHEN** the review search page has a settled query with `reviews.length === 0`
- **THEN** the page SHALL render `<EmptyState title={t("review.search.empty.title")} …/>` in place of the current inline `<Typography>No reviews found</Typography>`

#### Scenario: Search result list with zero results
- **WHEN** `SearchResultList` has a settled query with `result.items.length === 0`
- **THEN** the list SHALL render `<EmptyState title={t("search.empty.title")} …/>` in place of the current inline `<Typography>No results found</Typography>`

#### Scenario: Loading state is not an empty state
- **WHEN** a list's query is loading
- **THEN** the list SHALL NOT render `EmptyState`
- **AND** the caller's existing loading UX (skeleton or text) SHALL be used

#### Scenario: Error state is not an empty state
- **WHEN** a list's query has errored
- **THEN** the list SHALL NOT render `EmptyState`
- **AND** the caller SHALL render `QueryErrorDisplay` (or equivalent error UI) as today

### Requirement: Empty-state copy passes through i18n

The `title` and `description` props passed to `EmptyState` SHALL originate from i18n translation keys. Hard-coded English or mixed-language string literals SHALL NOT be passed as props. Call sites SHALL define translation keys under a per-feature namespace (e.g., `review.list.empty.title`, `excerpt.list.empty.title`, `remark.list.empty.title`, `search.empty.title`).

#### Scenario: Review empty state uses i18n
- **WHEN** `ReviewListSection` renders `EmptyState`
- **THEN** the `title` prop SHALL be `t("review.list.empty.title")` (or equivalent i18n call)
- **AND** the source SHALL NOT contain the literal string `"No reviews yet."` or `"No reviews found"`

#### Scenario: Translation fallback exists
- **WHEN** a translation key is missing
- **THEN** the i18n layer SHALL render the configured fallback (existing project behavior)
- **AND** the component SHALL NOT crash

### Requirement: Per-card field fallbacks are distinct from EmptyState

Per-card fallbacks (for example, `ExcerptCard` showing placeholder text when a specific translation field is missing) SHALL remain distinct from list-level `EmptyState`. A card whose parent list is non-empty SHALL continue to render — `EmptyState` applies only to `list.length === 0`. Per-card fallback strings SHALL still pass through i18n keys (aligned with the empty-state copy rule).

#### Scenario: Single card with missing field renders fallback
- **WHEN** an excerpt card's `excerpt.translations?.[0]?.description` is missing
- **THEN** the card SHALL render a localized per-field fallback (e.g., `t("excerpt.card.description.fallback")`)
- **AND** the parent list SHALL NOT render `EmptyState`

#### Scenario: All items have missing field vs list is empty
- **GIVEN** a list of 5 cards where every card's optional field is missing
- **WHEN** the list is rendered
- **THEN** each card SHALL render its own per-field fallback
- **AND** the list SHALL NOT render `EmptyState` (length is 5, not 0)

### Requirement: Shared EmptyState primitive

`@rezics/ui` SHALL export an `EmptyState` component from `package/ui/src/composite/feedback/EmptyState.tsx`. The component SHALL be composed of rezics-owned primitives (`<div>` + UnoCSS layout classes for the container, `<h3>` / `<p>` with token-driven typography classes for the title and description, optional icon slot, optional action slot accepting any `ReactNode` including a shadcn `Button`) and SHALL provide consistent spacing, alignment, and theming for list-level "no data" UX. The component API SHALL accept:

- `title: ReactNode` (required) — short headline text
- `description?: ReactNode` — optional supporting copy
- `icon?: ReactNode` — optional icon rendered above the title (typically a `lucide-react` icon)
- `action?: ReactNode` — optional CTA (e.g., a shadcn `Button`) rendered below

The component SHALL centrally align content horizontally and use responsive vertical padding via UnoCSS spacing classes (`py-12` / `py-16` for app surfaces; `py-6` for admin surfaces).

#### Scenario: Title-only usage

- **WHEN** `<EmptyState title="No reviews yet" />` is rendered
- **THEN** a centered stack SHALL display the title text with responsive padding
- **AND** no description, icon, or action slot SHALL render

#### Scenario: Full-slot usage

- **WHEN** `<EmptyState title={t(...)} description={t(...)} icon={<BookmarkIcon />} action={<Button>Create</Button>} />` is rendered
- **THEN** the icon SHALL appear above the title, description below the title, and action below the description

