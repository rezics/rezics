## MODIFIED Requirements

### Requirement: Convention check script exists and is runnable
A TypeScript script at `tool/scripts/check-convention.ts` SHALL implement the route and folder checks defined in `api-route-convention/spec.md` and `folder-naming-convention/spec.md`. The script SHALL be invokable via `bun run check:convention` at the repository root and SHALL exit with a non-zero status code when any violation is found. The script SHALL NOT require a baseline snapshot file to run — when `tool/scripts/expected-violations.json` is absent, the script SHALL treat the baseline as empty and fail on any violation (zero-tolerance). The `--snapshot` flag remains available so future migrations can opt into temporary baseline gating by regenerating the file.

#### Scenario: Clean repository passes
- **WHEN** a developer runs `bun run check:convention` on a repository with no violations and no baseline snapshot
- **THEN** the script prints a summary of folders scanned and exits with status 0

#### Scenario: Violation produces actionable output
- **WHEN** the script finds a plural route prefix or a non-allowlisted plural folder
- **THEN** the script prints the offending path, the rule that was violated, and a link to the relevant spec file, and exits with status 1

#### Scenario: Missing baseline snapshot is tolerated
- **WHEN** `tool/scripts/expected-violations.json` does not exist and the repository is clean
- **THEN** the script exits with status 0 without warning about the missing file

#### Scenario: Missing baseline snapshot is tolerated with new violation
- **WHEN** `tool/scripts/expected-violations.json` does not exist and a plural prefix is introduced
- **THEN** the script prints the violation and exits with status 1 (no baseline means every violation is "new")
