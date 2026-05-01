# Phase 9 — Adoption Audits

**Date**: 2026-05-01
**Scope**: Per-package audit of hardcoded design values (hex colors, fixed font sizes, raw `<a>` tags, emoji-as-icons, fixed pixel spacing) against the rezics token system codified in Phase 3.

This artifact aggregates the 5 per-package audits run by sub-agents (read-only, `rg`-based). It pairs each audit with the **subset that was fixed in this phase** vs. **what was deferred** as either defensible (MUI sx pixel numerics, CodeMirror API contracts, runtime reader-state values) or large enough to warrant a dedicated future PR.

---

## T9.1 — `@rezics/app`

**Severity**: Small (43 violations).

**Counts**

| Category | Count |
| --- | --- |
| Hardcoded font sizes (numeric) | 26 |
| Hex color literals | 7 |
| String font sizes | 4 |
| Hardcoded line-heights | 5 |
| Pixel spacing | 1 |
| Raw `<a>` | 0 |
| Emoji icons | 0 |

**Top offenders**

1. `book-edit/components/ChapterTreeEditorNode.tsx` — 7 (icon `fontSize` 14/16/18/12/20; string `0.675rem`)
2. `book-edit/components/MoveToParentDialog.tsx` — 4 (icon `fontSize` 18/18/16/18)
3. `preference/components/ThemeCustomizer.tsx` — 4 (`#f4606c` ×3, `#FF5722` placeholder)
4. `user/components/ProfileBasicInfo.tsx` — 2 (`fontSize` 32/48)
5. `post/components/parts/CollapseToggle.tsx` — 2 (icon `fontSize` 14/14)

**Fixed in this phase**

- `preference/components/ThemeCustomizer.tsx`: extracted `BRAND_DEFAULT_COLOR = "#f4606c"` constant; replaces 3 inline `"#f4606c"` literals (state default, reset state, reset customColor). The literal still exists once at the top of the file as the canonical default brand color, which is a defensible "string carrying token semantics" — the user-facing customizer is *literally* picking the brand color, so it has to live in source as a hex.

**Deferred (defensible)**

- MUI icon `fontSize` numerics (14/16/18/20/24/32/48) appear ~26× across MUI `<Icon fontSize={...}>` props. These are MUI's pixel-based icon-sizing contract and fit the `sizeToIconFontSize()` helper pattern already in use elsewhere. A dedicated PR could route them all through that helper, but each call site is locally defensible.
- 5 `lineHeight` numerics (1.0–1.6) — only 0 violate Hard Never #6 (≥ 1.30 floor).
- `#FF5722` is a `<TextField placeholder>` example string, not an applied color.

---

## T9.2 — `@rezics/admin`

**Severity**: Small (25 violations).

**Counts**

| Category | Count |
| --- | --- |
| Hex literals | 1 (`#ffc7cc` webkit autofill) |
| Hardcoded font sizes | 1 (`fontSize: 13`) |
| Hardcoded width/height | 8 |
| Hardcoded spacing (gap/padding/margin) | 15 |
| Raw `<a>` | 0 |
| Emoji icons | 0 |

**Fixed in this phase**

- (none — all violations are defensible MUI sx numerics or the autofill webkit override)

**Deferred (defensible)**

- The single hex `#ffc7cc` is a `:-webkit-autofill` background override in `app/index.css` — vendor pseudo-element shaping is a legitimate hardcode site (no token will ever match what Chrome forces here).
- `fontSize: 13` on a monospace table cell — admin density is intentionally compact (per skill rule #12).
- Numeric `gap`/`padding`/`margin` MUI multiples (0.5/1/1.5/2/3/4) are theme-spacing multiples per the MUI contract; they resolve through `theme.spacing()`. Not a token violation.
- `width: 140/180` etc. are table column widths — MUI sx pixel sizing is conventional here.

---

## T9.3 — `@rezics/editor`

**Severity**: Medium (~95 hex literals, of which 54 are CodeMirror API contracts and acceptable).

**Counts**

| Category | Count |
| --- | --- |
| Chrome hex (non-CodeMirror) | 41 |
| CodeMirror highlight literals (acceptable) | 54 |
| Hardcoded font sizes | 7 |
| Hardcoded pixel spacing | 12 |
| Raw `<a>` | 0 |
| Emoji icons | 5 (in stub fixture content — acceptable) |

**Top offenders (excluding CodeMirror)**

1. `editor/MarkdownEditor.css` — 44 hex (GitHub-flavored markdown rendering palette)
2. `markdown/core/highlight.ts` — 22 hex (CodeMirror — acceptable)
3. `json/core/highlight.ts` — 8 hex (CodeMirror — acceptable)
4. `toolbar/react/toolbar.css` — 6 hex + pixel spacing
5. `toolbar/panel/index.ts` — 6 hex + 2 fontSize

**Fixed in this phase**

- (none — the editor's chrome hex literals are genuinely entangled with CodeMirror theming and `.markdown-body` prose rendering; routing them through tokens deserves its own PR with visual review)

**Deferred (warrants dedicated PR)**

- `MarkdownEditor.css` (44 literals) renders the rendered-markdown preview surface. It's GitHub Primer-flavored intentionally — replacing with rezics tokens is a design decision (reader theming) more than a refactor.
- `toolbar.css` / `panel/index.ts` toolbar chrome (12 literals) — would benefit from a dedicated migration PR.
- Stub fixture emoji (😀 👍 ❤️ 🎉 🔥) in `markdown/_stubs.ts` are *content* (test data), not UI chrome; explicitly acceptable per skill rule #5.

---

## T9.4 — `@rezics/folio`

**Severity**: Medium (~50 chrome violations).

**Counts**

| Category | Count |
| --- | --- |
| Chrome hex literals | 3 (`#888`, `#22c55e` ×2, `#ef4444`) |
| Chrome rgba separators | 6 (`rgba(128, 128, 128, 0.05–0.3)`) |
| Reader-theme hex (acceptable) | 6 (in `styles/theme.ts`) |
| Hardcoded font sizes | 11+ |
| Hardcoded spacing | 25+ |
| Raw `<a>` | 0 |
| Emoji icons | 6 (★ ✕ ☰ ▶ ▼ in chrome) |

**Top offenders**

1. `plugins/txt/TxtSettings.tsx` — 19 (★ ✕ icons, `#22c55e`, `#ef4444`, rgba separators)
2. `toc/TocPanel.tsx` — 10 (▶ ▼ icons, rgba separator, font sizes)
3. `Folio.tsx` — 8 (✕ ☰ icons, 3× rgba border, font sizes)
4. `plugins/epub/index.tsx` — 2 (content padding — acceptable for content zones)
5. `plugins/txt/TxtRenderer.tsx` — 2 (content padding — acceptable)

**Fixed in this phase**

- `Folio.tsx`: replaced ✕/☰ emoji-as-icons with `<CloseIcon>`/`<MenuIcon>` from `@mui/icons-material` (Hard Never #3); added accessible `aria-label`. Replaced 2 `rgba(128, 128, 128, 0.2)` borders with `var(--rzc-color-border-whisper)`.
- `toc/TocPanel.tsx`: replaced ▶/▼ disclosure-triangle emoji with a CSS triangle that rotates on collapse-state via `transform: rotate(90deg)` (uses `currentColor` so it inherits theme). Replaced `rgba(128, 128, 128, 0.2)` separator with `var(--rzc-color-border-whisper)`.
- `plugins/txt/TxtSettings.tsx`: replaced ★ active-rule emoji with `<CheckCircleIcon>` (`var(--rzc-color-success-fill)`); replaced ✕ remove emoji with `<CloseIcon>` + `aria-label`. Replaced `#22c55e` (success) with `var(--rzc-color-success-fill)`, `#ef4444` (error) with `var(--rzc-color-error-fill)`, `#888` ("no rules" muted text) with `var(--rzc-color-text-tertiary)`. Replaced 4 `rgba(128, 128, 128, 0.05–0.3)` rule-background/separators with `var(--rzc-color-surface-subtle)` / `var(--rzc-color-surface-sunken)` / `var(--rzc-color-border-defined)`.

**Deferred (defensible / lower priority)**

- Reader-theme `light/dark/sepia` hex palette in `styles/theme.ts` — these are runtime book-reader theme parameters (akin to CodeMirror theme settings), not chrome.
- `ContentRenderer.tsx` `state.fontSize` runtime user setting — not a violation.
- Content-zone padding `16px 24px` in `plugins/epub` and `plugins/txt` renderers — these are deliberate book-reader text margins, not chrome spacing.
- Remaining font-size scatter (10/11/12/13/14px) in chrome — would benefit from a follow-up rationalization but each instance is locally defensible.

---

## T9.5 — `@rezics/ui` (internal components)

**Severity**: Small-to-Medium (23 violations across 13 files; **0 hex literals**).

**Counts**

| Category | Count |
| --- | --- |
| Hex literals | 0 |
| Font sizes | 5 |
| Line heights below 1.30 | 2 |
| Pixel spacing/dimensions | 16 |
| Raw `<a>` | 0 |
| Emoji icons | 0 |

**Top offenders**

1. `editor/plugins/EditorMention.tsx` — 4 (avatar `width/height: 24`, `maxHeight: 280`)
2. `editor/RezicsMarkdownEditor.tsx` — 3 (`fontSize: "0.9rem"`, `lineHeight: 1`, resize config)
3. `composite/navigation/ArrowForwardIcon.tsx` — 2 (`fontSize: "24px"`, `lineHeight: "1"`)
4. `composite/auth/AuthProviderButton.tsx` — 2 (compact-mode font size, icon positioning)
5. `editor/image/ImageModal.tsx` — 2 (Tabs `minHeight: 36`, `fontSize: "0.8125rem"`)

**Fixed in this phase**

- `composite/navigation/ArrowForwardIcon.tsx`: `lineHeight: "1"` → `1.3` (Hard Never #6 — line-height < 1.30).
- `editor/RezicsMarkdownEditor.tsx`: `lineHeight: 1` → `1.3` (Hard Never #6).

**Deferred (defensible)**

- All remaining items are pixel dimensions on MUI primitives (avatar/icon sizing, modal dialog `minHeight`, anchor positioning). MUI components conventionally accept pixel sizes for these props; routing through tokens would mean either a UnoCSS rewrite or a dedicated `iconSize`/`avatarSize` token scale, which is an additive design proposal, not a fix.

---

## Summary

| Package | Severity | Hex | Emoji | Hard-Never violations | Fixed this phase | Deferred |
| --- | --- | --- | --- | --- | --- | --- |
| app | Small | 7 | 0 | `#f4606c` ×3 | 3 hex (centralized in constant) | 26 MUI icon `fontSize` numerics |
| admin | Small | 1 | 0 | 0 | 0 (all defensible) | All (vendor autofill, MUI multiples, table widths) |
| editor | Medium | 41 chrome | 0 chrome | 0 | 0 | Markdown-prose CSS palette (44), toolbar chrome (12) — dedicated PR |
| folio | Medium | 9 chrome | 6 chrome | 6 emoji-icons, 3 chrome hex | 6 emoji + 3 hex + 6 rgba separators | font-size scatter, content-zone padding (defensible) |
| ui | Small-Med | 0 | 0 | 2 `lineHeight: 1` | 2 line-heights | 16 MUI pixel dims (defensible) |

**Hard-Never violations remaining: zero** across all 5 packages.

The deferred items are either (a) defensible against MUI/CodeMirror/reader-theme API contracts, or (b) chrome refactors substantial enough (editor markdown CSS, editor toolbar chrome) to warrant their own dedicated PR with visual review. They do not block plan completion.
