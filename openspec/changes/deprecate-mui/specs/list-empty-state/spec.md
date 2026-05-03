## MODIFIED Requirements

### Requirement: Shared EmptyState primitive

`@rezics/ui` SHALL export an `EmptyState` component from `package/ui/src/composite/feedback/EmptyState.tsx`. The component SHALL be composed of rezics-owned primitives (`<div>` + UnoCSS layout classes for the container, `<h3>` / `<p>` with token-driven typography classes for the title and description, optional icon slot, optional action slot accepting any `ReactNode` including a shadcn `Button`) and SHALL provide consistent spacing, alignment, and theming for list-level "no data" UX. The component SHALL NOT import from `@mui/material`. The component API SHALL accept:

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

#### Scenario: No MUI imports

- **WHEN** `package/ui/src/composite/feedback/EmptyState.tsx` is inspected
- **THEN** there SHALL be no import from `@mui/material` or `@mui/icons-material`
