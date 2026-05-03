## ADDED Requirements

### Requirement: R8 — No `@mui/*` imports outside the deprecate-mui change archive

The `tool/scripts/check-convention.ts` script SHALL implement an eighth rule (R8) that fails when any source file under `package/*/src/` contains a TypeScript/JavaScript import from `@mui/*` (any subpackage, including `@mui/material`, `@mui/icons-material`, `@mui/lab`, `@mui/material/styles`, `@mui/x-*`). The rule SHALL also fail when any `package/*/package.json` declares an `@mui/*` package or `@material/material-color-utilities` in `dependencies`, `devDependencies`, `peerDependencies`, or `optionalDependencies`.

The rule SHALL apply to every `*.ts`, `*.tsx`, `*.js`, `*.jsx`, and `*.mdx` file under `package/*/src/`, plus every `package/*/package.json`. The check MAY use a regex scan as the initial implementation. If false positives become a problem (e.g., a string literal containing `from "@mui/`), the implementation SHALL be promoted to an AST scan via the TypeScript compiler API or `oxc-parser` without changing the rule's contract.

R8 SHALL be activated at the end of the `deprecate-mui` change implementation — once the last `@mui/*` import has been removed from source code and the last `@mui/*` declaration has been removed from `package.json`. R8 SHALL NOT have any per-site allowlist (no `expected-violations.json` carve-outs) — the rule is absolute. The only path to introducing an `@mui/*` import in the future SHALL be an OpenSpec change that updates the `ui-component-foundation` and `convention-enforcement` specs jointly.

#### Scenario: Source file imports `@mui/material`

- **WHEN** a `.tsx` or `.ts` file under `package/*/src/` contains `from "@mui/material"` (or any subpath)
- **THEN** `bun run check:convention` exits with status 1 and prints the offending file, line number, and the R8 spec reference

#### Scenario: Source file imports `@mui/icons-material`

- **WHEN** a `.tsx` or `.ts` file under `package/*/src/` contains `from "@mui/icons-material"` (default or named)
- **THEN** `bun run check:convention` exits with status 1 and prints the offending file, line number, and the R8 spec reference

#### Scenario: package.json declares `@mui/material`

- **WHEN** any `package/*/package.json` contains `"@mui/material"` in any dependency field
- **THEN** `bun run check:convention` exits with status 1 and prints the offending package, dependency name, and the R8 spec reference

#### Scenario: package.json declares `@material/material-color-utilities`

- **WHEN** any `package/*/package.json` contains `"@material/material-color-utilities"` in any dependency field
- **THEN** `bun run check:convention` exits with status 1

#### Scenario: No allowlist or per-site exception

- **WHEN** a developer attempts to add an `expected-violations.json` entry for an R8 violation
- **THEN** the convention checker SHALL ignore the entry and still fail on the violation
- **AND** the R8 rule SHALL NOT support per-site suppression

#### Scenario: Rule documented in CLAUDE.md

- **WHEN** a contributor reads `CLAUDE.md`'s "API Route & Folder Convention" section (or its successor "Convention Enforcement" section)
- **THEN** that section (or an adjacent section) mentions R8 and points to the `ui-component-foundation` spec as the authoritative source
- **AND** the section SHALL state that MUI is permanently removed and that introducing it requires an OpenSpec change

### Requirement: R8 SPEC_LINK is registered in the check script

The `SPEC_LINK` map in `tool/scripts/check-convention.ts` SHALL include the entry `R8: "openspec/specs/ui-component-foundation/spec.md"`. The `Rule` union type SHALL include `"R8"`. The script's preamble comment SHALL list R8 in the rule summary table.

#### Scenario: SPEC_LINK includes R8

- **WHEN** `tool/scripts/check-convention.ts` is inspected
- **THEN** the `SPEC_LINK` map SHALL contain a key `R8` mapping to the `ui-component-foundation` spec path
- **AND** the `Rule` union type SHALL include `"R8"`
- **AND** the preamble comment SHALL list R8 with a one-line description
