## ADDED Requirements

### Requirement: Manage icon placement in RealmPage header

The manage icon SHALL appear in the realm detail page header row, positioned near the realm title and join button. The icon SHALL be a `lucide-react` icon — preferably `Settings`, `Settings2`, or `SlidersHorizontal` — recorded in the rezics-design icon mapping table at `.claude/skills/rezics-design/icons.md`. The icon SHALL link to `/realm/:realmId/manage`.

#### Scenario: Manage icon renders in header

- **WHEN** a user with manage permission views the realm detail page
- **THEN** the realm header SHALL render a `lucide-react` settings icon (`Settings`, `Settings2`, or `SlidersHorizontal`) anchored near the realm title and join button
- **AND** the icon SHALL link to `/realm/:realmId/manage`
- **AND** the import SHALL come from `lucide-react` (not `@mui/icons-material`)
