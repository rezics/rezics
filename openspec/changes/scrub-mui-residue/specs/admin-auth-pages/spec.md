## MODIFIED Requirements

### Requirement: Auth navigation section in sidebar

The admin sidebar navigation (`package/admin/src/navigation/adminNavConfig.tsx`) SHALL include an "Auth" group with children:

- "Users" → `/auth/users`
- "Sessions" → `/auth/sessions`

The group SHALL use a security-related icon — see "Admin auth nav group icon" for the icon source rule.

#### Scenario: Auth nav group visible in sidebar

- **WHEN** an admin views the sidebar navigation
- **THEN** an "Auth" group SHALL be visible with "Users" and "Sessions" sub-items

#### Scenario: Clicking auth nav item navigates correctly

- **WHEN** an admin clicks "Users" under the "Auth" nav group
- **THEN** the browser SHALL navigate to `/auth/users`

### Requirement: Admin auth nav group icon

The admin sidebar's "Auth" navigation group SHALL use a security-related icon from `lucide-react`, specifically `Shield`, `ShieldUser`, or `ShieldCheck`. The selected icon SHALL be recorded in the rezics-design skill at `.claude/skills/rezics-design/icons.md`.

#### Scenario: Auth nav group renders security icon

- **WHEN** an admin views the sidebar navigation
- **THEN** an "Auth" group SHALL be visible with a `lucide-react` security icon (`Shield`, `ShieldUser`, or `ShieldCheck`)
- **AND** the icon import SHALL come from `lucide-react`

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

#### Scenario: Auth users page follows layout convention

- **WHEN** the `AuthUsersPage` renders
- **THEN** it SHALL use the `Page` wrapper with title "Auth Users" and a description, and display data in a `Card` > `CardContent` > `PaginatedTable` structure
- **AND** the `Card` and `CardContent` imports SHALL come from `@rezics/ui/shadcn`

#### Scenario: Admin density preserved

- **WHEN** any admin page renders
- **THEN** it SHALL use compact-density UnoCSS classes (`p-4`–`p-6` containers, smaller text scales) per the design-system voice rules for admin

## REMOVED Requirements

### Requirement: Page component conventions

**Reason**: Superseded by "Admin pages follow shadcn-or-custom layout convention" (preserved above as a MODIFIED requirement). The obsolete version named MUI components (`Card`, `CardContent`, `Button`, `Typography`, etc.) as the layout source; the active version uses shadcn primitives from `@rezics/ui/shadcn`. Keeping both creates two contradictory layout contracts.

**Migration**: None at the codebase level — the auth admin pages already render with shadcn primitives. The active "shadcn-or-custom layout convention" requirement is the sole authority going forward.
