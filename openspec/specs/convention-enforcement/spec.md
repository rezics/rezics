## ADDED Requirements

### Requirement: Convention check script exists and is runnable
A TypeScript script at `tool/scripts/check-convention.ts` SHALL implement the route and folder checks defined in `api-route-convention/spec.md` and `folder-naming-convention/spec.md`. The script SHALL be invokable via `bun run check:convention` at the repository root and SHALL exit with a non-zero status code when any violation is found.

#### Scenario: Clean repository passes
- **WHEN** a developer runs `bun run check:convention` on a repository with no violations
- **THEN** the script prints a summary of folders scanned and exits with status 0

#### Scenario: Violation produces actionable output
- **WHEN** the script finds a plural route prefix or a non-allowlisted plural folder
- **THEN** the script prints the offending path, the rule that was violated, and a link to the relevant spec file, and exits with status 1

### Requirement: Pre-commit hook runs the check
The repository's pre-commit hook configuration (`lefthook.yml` or equivalent) SHALL include a step that runs `bun run check:convention` and blocks the commit when the check fails. The hook SHALL only scan files staged for commit when possible, falling back to a full scan when a staged-mode invocation is impractical.

#### Scenario: Commit with clean changes
- **WHEN** a developer commits changes that do not introduce convention violations
- **THEN** the pre-commit hook completes without blocking

#### Scenario: Commit introduces a plural route prefix
- **WHEN** a developer commits `new Elysia({ prefix: "/widgets" })`
- **THEN** the pre-commit hook rejects the commit with the same actionable message as the manual script

### Requirement: PR merge gate runs the check
A GitHub Actions workflow SHALL run `bun run check:convention` (full scan) on pull requests targeting `dev`. A failing check SHALL block merge. The check SHALL NOT run on every push — only on PR events.

#### Scenario: PR with convention violation
- **WHEN** a pull request is opened that introduces a plural domain folder
- **THEN** the PR check fails with the violation path in the failure message

#### Scenario: PR with only test changes
- **WHEN** a PR touches only test files and introduces no folder or route changes
- **THEN** the convention check passes

### Requirement: No per-site suppression mechanism
The check script SHALL NOT accept inline comments, ignore files, or configuration overrides that exempt specific paths from validation. Adjustments SHALL only be possible by editing the allowlists defined inside the script (which mirror the specs) — and those edits require a spec amendment per `folder-naming-convention/spec.md`.

#### Scenario: Developer attempts to add an ignore comment
- **WHEN** a developer adds `// eslint-disable-next-line` or an `.conventionignore` file
- **THEN** the check script ignores these markers entirely and still fails on the violation

### Requirement: Check script reflects spec allowlists
The plural container allowlist and the special-case prefix allowlist inside `check-convention.ts` SHALL be the exact set defined in `folder-naming-convention/spec.md` and `api-route-convention/spec.md`. When the specs are amended, the script SHALL be updated in the same change.

#### Scenario: Spec amendment without script update
- **WHEN** an OpenSpec change modifies the container allowlist in `folder-naming-convention/spec.md` but does not update `check-convention.ts`
- **THEN** the change's archive validation SHALL flag the mismatch as incomplete

### Requirement: CLAUDE.md documents the convention and enforcement
`CLAUDE.md` SHALL gain a section named "API Route & Folder Convention" that summarizes the three requirements families (singular resources, `/list` suffix, β dual-track folders) in a form short enough to be absorbed during a normal reading, and points to `openspec/specs/api-route-convention/spec.md`, `openspec/specs/folder-naming-convention/spec.md`, and `openspec/specs/convention-enforcement/spec.md` as authoritative sources.

#### Scenario: New contributor reads CLAUDE.md
- **WHEN** a developer (or Claude) reads `CLAUDE.md` before starting work
- **THEN** they see a concise summary of the convention and know where to find the full spec

#### Scenario: Convention evolves
- **WHEN** a future change amends any of the three specs
- **THEN** the author SHALL update the CLAUDE.md summary in the same change if the summary becomes stale
