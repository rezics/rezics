## REMOVED Requirements

### Requirement: R8 — No `@mui/*` imports outside the deprecate-mui change archive

**Reason**: The `deprecate-mui` migration is complete and archived. No `@mui/*` package or `@material/material-color-utilities` is installed in any `package/*/package.json`, and no source file imports from those packages. R8 scans for an import that cannot occur, costing every check-convention run cycles for a rule that can never fire. The shadcn-or-custom component-selection policy is enforced at the spec level (`ui-component-foundation/spec.md`) and through code review.

**Migration**: Delete the R8 implementation from `tool/scripts/check-convention.ts`: the `R8_IMPORT_PATTERN` and `R8_FORBIDDEN_PACKAGE_PATTERN` regexes, the `scanMuiSourceImports` and `scanMuiPackageJson` functions, the `Rule` union member `"R8"`, the `SPEC_LINK.R8` entry, the R8 line in the summary log, and the baseline-key filter that strips R8 keys. The `expected-violations.json` snapshot needs no migration because R8 was already absolute (no per-site allowlist). Reintroducing an MUI rule in the future requires an OpenSpec change that adds it back.

### Requirement: R8 SPEC_LINK is registered in the check script

**Reason**: R8 is removed; its `SPEC_LINK` entry, `Rule` union member, and preamble line are no longer needed.

**Migration**: Remove the `R8` key from the `SPEC_LINK` map, remove `"R8"` from the `Rule` union type, and delete the R8 row from the rule summary comment in `tool/scripts/check-convention.ts`. These edits ship in the same change as the R8 implementation removal above.
