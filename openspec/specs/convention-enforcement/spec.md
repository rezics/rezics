## ADDED Requirements

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

### Requirement: Enforcement is pre-commit + PR merge gate (not CI)
The convention check runs as a **pre-commit hook** (`--staged` mode) and as a **PR merge gate** (full scan on PRs targeting `dev`). It SHALL NOT run in CI on every push. This keeps the feedback loop local and lightweight while still blocking merges that bypass pre-commit.

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

### Requirement: R5 — No raw `<a href>` outside the Link primitive
The `tool/scripts/check-convention.ts` script SHALL implement a fifth rule (R5) that fails when a `.tsx` file contains a JSX `<a>` element with an `href` attribute, unless that file appears in an explicit allowlist. The allowlist SHALL contain the file(s) implementing the `<SafeLink>` primitive (in `package/ui`) and any narrow exceptions captured in `tool/scripts/expected-violations.json`. The rule SHALL apply to every `.tsx` file under `package/`.

The check MAY use a regex scan as the initial implementation. If false positives become a problem (e.g., string literals containing `"<a href"`), the implementation SHALL be promoted to an AST scan via the TypeScript compiler API or `oxc-parser` without changing the rule's contract.

#### Scenario: Raw `<a>` in a feature file fails
- **WHEN** a `.tsx` file outside the allowlist contains `<a href="https://example.com">go</a>`
- **THEN** `bun run check:convention` exits with status 1 and prints the offending file, line number, and the R5 spec reference

#### Scenario: `<SafeLink>` primitive file passes
- **WHEN** the file implementing `<SafeLink>` itself contains `<a href={…}>` as part of the primitive's render output
- **THEN** R5 does not fire because the file is on the allowlist

#### Scenario: Snapshot grandfathered exception passes
- **WHEN** a `.tsx` file appears in `tool/scripts/expected-violations.json` under the R5 section, with a comment field explaining the exception
- **THEN** R5 reports the violation as expected and does not fail the run

#### Scenario: New violation in an otherwise allowlisted file
- **WHEN** a file appearing in the snapshot for one R5 violation gains a second raw `<a>` not recorded in the snapshot
- **THEN** R5 fails on the new violation while continuing to tolerate the snapshotted one

#### Scenario: Rule documented in CLAUDE.md
- **WHEN** a contributor reads `CLAUDE.md`'s "API Route & Folder Convention" section
- **THEN** that section (or an adjacent section) mentions the link-rendering convention and points to the `outbound-link-protection` spec as the authoritative source
