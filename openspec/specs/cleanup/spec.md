## Requirements

### Requirement: Zero biome lint errors
The codebase SHALL have zero biome lint errors when running `bunx biome check .`. Warnings are not in scope.

#### Scenario: Clean biome check
- **WHEN** `bunx biome check . --max-diagnostics=9999` is run from the repo root
- **THEN** output reports 0 errors

### Requirement: Zero TypeScript type errors
Each package SHALL have zero TypeScript errors when running `tsc --noEmit` with its own `tsconfig.json`.

#### Scenario: Clean type check per package
- **WHEN** `tsc --noEmit -p package/<name>/tsconfig.json` is run for each package
- **THEN** output reports 0 errors

### Requirement: No behavior changes
All fixes SHALL preserve existing runtime behavior. No user-facing functionality, API contracts, or rendering output SHALL change.

#### Scenario: Existing functionality preserved
- **WHEN** the application is built and run after all fixes
- **THEN** all pages render identically and all API endpoints respond identically to before the change
