## ADDED Requirements

### Requirement: Admin auth nav group icon

The admin sidebar's "Auth" navigation group SHALL use a security-related icon from `lucide-react`, specifically `Shield`, `ShieldUser`, or `ShieldCheck`. The selected icon SHALL be recorded in the rezics-design icon mapping table at `.claude/skills/rezics-design/icons.md`.

#### Scenario: Auth nav group renders security icon

- **WHEN** an admin views the sidebar navigation
- **THEN** an "Auth" group SHALL be visible with a `lucide-react` security icon (`Shield`, `ShieldUser`, or `ShieldCheck`)
- **AND** the icon import SHALL come from `lucide-react` (not `@mui/icons-material`)

#### Scenario: Auth nav group items navigate correctly

- **WHEN** an admin clicks "Users" under the "Auth" nav group
- **THEN** the browser SHALL navigate to `/auth/users`

### Requirement: Admin pages follow shadcn-or-custom layout convention

Admin pages SHALL follow the existing layout patterns and component conventions, using `@rezics/ui/shadcn` primitives and rezics-owned composites:

- Use `Page` wrapper from `@/component/Page`
- Use `PaginatedTable` from `@/component/table/PaginatedTable` for data tables
- Use shadcn primitives from `@rezics/ui/shadcn` (`Card`, `CardContent`, `Button`, `Badge`, `Alert`, etc.) and rezics-owned composites for layout and typography
- Use `useQuery` and mutation hooks from `@tanstack/react-query`
- Handle loading, error, and empty states using `<EmptyState>` from `@rezics/ui` and `<QueryErrorDisplay>` per their respective specs
- SHALL NOT import from `@mui/material` or `@mui/icons-material`

#### Scenario: Auth users page follows layout convention

- **WHEN** the `AuthUsersPage` renders
- **THEN** it SHALL use the `Page` wrapper with title "Auth Users" and a description, and display data in a `Card` > `CardContent` > `PaginatedTable` structure
- **AND** the `Card` and `CardContent` imports SHALL come from `@rezics/ui/shadcn`
- **AND** there SHALL be no import from `@mui/material` in the page module

#### Scenario: Admin density preserved

- **WHEN** any admin page renders
- **THEN** it SHALL use compact-density UnoCSS classes (`p-4`–`p-6` containers, smaller text scales) per the design-system voice rules for admin
- **AND** the absence of MUI SHALL NOT relax the density rule
