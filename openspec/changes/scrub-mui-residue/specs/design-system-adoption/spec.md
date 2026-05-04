## MODIFIED Requirements

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

- **CodeMirror `highlight.ts` hex literals** — CodeMirror's `HighlightStyle` API takes literal colors as a contract.
- **Vendor pseudo-element overrides** — `:-webkit-autofill` background and similar browser-forced surfaces are legitimate hardcode sites.
- **Reader-theme runtime parameters** — `package/folio/src/styles/theme.ts` `light/dark/sepia` palettes are user-facing book-reader settings, not chrome.
- **Content-zone padding** in `package/folio/src/plugins/{txt,epub}` renderers — deliberate book-reader text margins.
- **Stub fixture / test content** containing emoji, hex, or fixed font sizes — these are content, not chrome.
- **Admin density numerics** (`fontSize: 13` on monospace table cells, etc.) — admin is intentionally compact per voice rule.

#### Scenario: Defensible items not forced

- **WHEN** an adoption audit lists defensible items
- **THEN** each entry SHALL include a one-sentence rationale tying back to one of the categories above
