## ADDED Requirements

### Requirement: R5 — No raw `<a href>` outside the Link primitive
The `tool/scripts/check-convention.ts` script SHALL implement a fifth rule (R5) that fails when a `.tsx` file contains a JSX `<a>` element with an `href` attribute, unless that file appears in an explicit allowlist. The allowlist SHALL contain the file(s) implementing the `<Link>` primitive (in `package/ui`) and any narrow exceptions captured in `tool/scripts/expected-violations.json`. The rule SHALL apply to every `.tsx` file under `package/`.

The check MAY use a regex scan as the initial implementation. If false positives become a problem (e.g., string literals containing `"<a href"`), the implementation SHALL be promoted to an AST scan via the TypeScript compiler API or `oxc-parser` without changing the rule's contract.

#### Scenario: Raw `<a>` in a feature file fails
- **WHEN** a `.tsx` file outside the allowlist contains `<a href="https://example.com">go</a>`
- **THEN** `bun run check:convention` exits with status 1 and prints the offending file, line number, and the R5 spec reference

#### Scenario: `<Link>` primitive file passes
- **WHEN** the file implementing `<Link>` itself contains `<a href={…}>` as part of the primitive's render output
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
