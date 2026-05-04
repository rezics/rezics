# query-error-display Specification

## Purpose

Defines the shared `<QueryErrorDisplay>` component used across `@rezics/app` to render TanStack Query errors inline. The component standardizes error presentation (message, HTTP status, optional Prisma technical details) using shadcn `Alert` and `Collapsible`, replacing ad-hoc error rendering patterns.

## Requirements

### Requirement: Shared QueryErrorDisplay component
`package/app` SHALL provide a `<QueryErrorDisplay>` component that renders query errors inline, replacing the content area where data would have appeared.

#### Scenario: ApiError with detail
- **WHEN** the `error` prop is an `ApiError` with `detail.prisma`
- **THEN** the component SHALL display the human-readable `message` prominently
- **AND** SHALL render a collapsible "Technical details" section (collapsed by default) showing Prisma code, model, operation, and HTTP status

#### Scenario: ApiError without detail
- **WHEN** the `error` prop is an `ApiError` without a `detail` field
- **THEN** the component SHALL display the `message` and HTTP status
- **AND** SHALL NOT render the "Technical details" section

#### Scenario: Non-ApiError
- **WHEN** the `error` prop is a plain `Error` (not `ApiError`)
- **THEN** the component SHALL display `error.message` as fallback

#### Scenario: Null error
- **WHEN** the `error` prop is `null`
- **THEN** the component SHALL render nothing

### Requirement: Replace ad-hoc error rendering
All existing ad-hoc error rendering patterns in `package/app` pages and sections SHALL be replaced with `<QueryErrorDisplay>`. Each page retains control of when and where to render the component.

#### Scenario: Page with useQuery error
- **WHEN** a page destructures `{ error }` from `useQuery`
- **AND** `error` is truthy
- **THEN** the page SHALL render `<QueryErrorDisplay error={error} />` in place of the content area

#### Scenario: Existing patterns removed
- **WHEN** migration is complete
- **THEN** no page in `package/app` SHALL contain `String(error)`, `error.message` inline rendering, `JSON.stringify(error)`, or hardcoded error strings for query failures

### Requirement: shadcn Alert-based styling

The component SHALL use shadcn `Alert` (from `@rezics/ui/shadcn`) with destructive variant for the error container, consistent with existing error display patterns in auth pages and other rezics surfaces. Collapsible technical-detail sections SHALL use shadcn `Collapsible`.

#### Scenario: Visual consistency

- **WHEN** `<QueryErrorDisplay>` renders an error
- **THEN** it SHALL use shadcn `Alert` from `@rezics/ui/shadcn` with the destructive variant
- **AND** the collapsible section SHALL use shadcn `Collapsible`

#### Scenario: Token-aligned destructive variant

- **WHEN** the destructive variant of shadcn `Alert` renders
- **THEN** the surface and border SHALL derive from `--rezics-color-error-fill` / `--rezics-color-error-text` / `--rezics-color-border-error` tokens

