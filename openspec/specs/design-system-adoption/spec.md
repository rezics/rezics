### Requirement: Adoption audits use a fixed format

A per-package adoption audit SHALL produce, at minimum:

- **Severity**: Small / Medium / Large by violation count and category mix.
- **Counts table**: hex literals, font sizes, line heights, pixel spacing, raw `<a>`, emoji icons.
- **Top offenders**: 3–5 worst files with violation counts.
- **Fixed in this phase**: violations resolved inline, with the specific file paths and replacement tokens.
- **Deferred**: split into "defensible" (with rationale) and "warrants dedicated PR" (with rationale).

#### Scenario: Audit produces all sections

- **WHEN** an adoption audit is run for any package and recorded
- **THEN** the resulting record SHALL include all five sections above
- **AND** the Deferred section SHALL distinguish defensible items from items warranting a dedicated PR

#### Scenario: Five package audits aggregated

- **WHEN** the design-system change archive is consulted for adoption results
- **THEN** the aggregated audit SHALL cover at minimum `@rezics/app`, `@rezics/admin`, `@rezics/editor`, `@rezics/folio`, and `@rezics/ui`
- **AND** each package SHALL have severity, counts, top offenders, fixed, and deferred sections

### Requirement: Hard-Never violations block adoption sign-off

The following categories SHALL be classified as Hard-Never and SHALL be fixed inline before an audit is signed off:

- Brand color `#f4606c` used as text color, or scattered as a string literal across more than one site.
- Emoji used as UI chrome icon (close ✕, menu ☰, disclosure ▶/▼, star/check ★, etc.).
- `line-height` set below `1.30`.
- Raw `<a href>` used for outbound links (subject to `outbound-link-protection` spec).
- Pure white `#ffffff` or pure black `#000000` used as page canvas background.
- Decorative `box-shadow` on cards / sections / panels (modal-tier only).

#### Scenario: Hard-Never count is zero post-audit

- **WHEN** the design-system audit aggregate is consulted
- **THEN** the Hard-Never violations remaining count SHALL be zero across all 5 packages

### Requirement: Defensible categories are documented, not force-migrated

The following categories SHALL be classified as defensible and SHALL NOT be forced through migration during a design-system audit. Each SHALL be documented in the deferred section with the rationale shown:

- **MUI icon `fontSize` numerics** (14 / 16 / 18 / 20 / 24 etc.) — MUI's icon-sizing API takes pixel values; routing through tokens requires a dedicated `iconSize` token scale, an additive design proposal.
- **MUI sx integer multiples** for `gap` / `padding` / `margin` / `width` / `height` — these resolve through `theme.spacing()` per MUI contract; not token violations.
- **CodeMirror `highlight.ts` hex literals** — CodeMirror's `HighlightStyle` API takes literal colors as a contract.
- **Vendor pseudo-element overrides** — `:-webkit-autofill` background and similar browser-forced surfaces are legitimate hardcode sites.
- **Reader-theme runtime parameters** — `package/folio/src/styles/theme.ts` `light/dark/sepia` palettes are user-facing book-reader settings, not chrome.
- **Content-zone padding** in `package/folio/src/plugins/{txt,epub}` renderers — deliberate book-reader text margins.
- **Stub fixture / test content** containing emoji, hex, or fixed font sizes — these are content, not chrome.
- **Admin density numerics** (`fontSize: 13` on monospace table cells, etc.) — admin is intentionally compact per voice rule.

#### Scenario: Defensible items not forced

- **WHEN** an adoption audit lists defensible items
- **THEN** each entry SHALL include a one-sentence rationale tying back to one of the categories above

### Requirement: Large refactors are deferred to dedicated PRs

When an audit surfaces a chrome refactor large enough to require visual review (multi-file CSS palette migration, toolbar chrome rewrite), the audit SHALL classify it as "warrants dedicated PR" rather than fixing it inline. The audit SHALL identify the specific files, the violation count, and the rationale for deferral.

#### Scenario: Editor markdown CSS palette deferred with rationale

- **WHEN** the `@rezics/editor` audit is read
- **THEN** the deferred section SHALL identify `MarkdownEditor.css` (44 hex literals, GitHub Primer–flavored markdown prose palette) and toolbar chrome (`toolbar.css` / `panel/index.ts`, ~12 literals) as warranting their own dedicated PR
- **AND** the rationale SHALL note that these surfaces require visual review against rendered-markdown reading experience

### Requirement: Audit fixes use existing tokens, not new ones

When an audit fixes a Hard-Never violation, the replacement SHALL use an existing token from the foundation. The audit SHALL NOT introduce new tokens to make a fix work; if no fitting token exists, the violation SHALL be classified as deferred (additive design proposal) instead.

#### Scenario: Fixed violations cite existing tokens

- **WHEN** an audit's "Fixed in this phase" section is inspected
- **THEN** every replacement SHALL cite a token already declared in the foundation (`--rezics-color-*`, `--rezics-space-*`, `--rezics-radius-*`, etc.) or an existing helper / constant
- **AND** no fix SHALL ship a brand-new token name

### Requirement: Audit findings are reproducible via `rg`

The audit SHALL document the search patterns used to find each violation category (hex literals, fontSize numerics, emoji-as-icon, raw `<a>`, line-height numerics, pixel spacing) so future audits can reproduce the methodology.

#### Scenario: Methodology preserved

- **WHEN** the design-system aggregate audit is consulted
- **THEN** it SHALL describe (or link to) the `rg` patterns used per category
- **AND** running the same patterns against the same package SHALL produce comparable counts modulo subsequent fixes
## Requirements
### Requirement: Hard-Never violations block adoption sign-off

The following categories SHALL be classified as Hard-Never and SHALL be fixed inline before an audit is signed off:

- Brand color `#f4606c` used as text color, or scattered as a string literal across more than one site.
- Emoji used as UI chrome icon (close ✕, menu ☰, disclosure ▶/▼, star/check ★, etc.).
- `line-height` set below `1.30`.
- Raw `<a href>` used for outbound links (subject to `outbound-link-protection` spec).
- Pure white `#ffffff` or pure black `#000000` used as page canvas background.
- Decorative `box-shadow` on cards / sections / panels (modal-tier only).
- `@mui/*` imports in any source file under `package/*/src/` (subject to `ui-component-foundation` spec and convention-check R8).

#### Scenario: Hard-Never count is zero post-audit

- **WHEN** the design-system audit aggregate is consulted
- **THEN** the Hard-Never violations remaining count SHALL be zero across all 5 packages
- **AND** the count SHALL include `@mui/*` import violations

### Requirement: Defensible categories are documented, not force-migrated

The following categories SHALL be classified as defensible and SHALL NOT be forced through migration during a design-system audit. Each SHALL be documented in the deferred section with the rationale shown:

- **CodeMirror `highlight.ts` hex literals** — CodeMirror's `HighlightStyle` API takes literal colors as a contract.
- **Vendor pseudo-element overrides** — `:-webkit-autofill` background and similar browser-forced surfaces are legitimate hardcode sites.
- **Reader-theme runtime parameters** — `package/folio/src/styles/theme.ts` `light/dark/sepia` palettes are user-facing book-reader settings, not chrome.
- **Content-zone padding** in `package/folio/src/plugins/{txt,epub}` renderers — deliberate book-reader text margins.
- **Stub fixture / test content** containing emoji, hex, or fixed font sizes — these are content, not chrome.
- **Admin density numerics** (`fontSize: 13` on monospace table cells, etc.) — admin is intentionally compact per voice rule.

#### Scenario: Defensible items not forced

- **WHEN** an adoption audit lists defensible items
- **THEN** each entry SHALL include a one-sentence rationale tying back to one of the categories above

#### Scenario: MUI-related defensibles are not present

- **WHEN** an adoption audit run after this change is consulted
- **THEN** the defensible section SHALL NOT contain entries referencing "MUI icon `fontSize` numerics" or "MUI sx integer multiples"
- **AND** any such legacy defensibles in archived audits SHALL be marked as obsolete

