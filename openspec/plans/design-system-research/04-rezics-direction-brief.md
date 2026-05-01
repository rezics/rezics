# rezics Design Direction Brief

> **⚠️ SUPERSEDED on 2026-05-01** — This v0 brief was rejected for treating rezics as a generic book library and missing the actual product surface diversity (game library, media library, post forum, tag system, app vs admin split) plus the brand color (轮回红 `#f4606c`). Retained for historical reference only.
> 
> **Canonical replacement**: `briefs/01-foundation-v1.md` (Phase 2A — Brand Foundation only). Surface-specific briefs (Library family / UGC / Admin / etc.) follow as separate documents.

**Status**: Phase 2 deliverable — **Gate-A artifact**, awaiting user approval before Phase 3 begins.
**Date**: 2026-05-01
**Sources**: Synthesized from `02-token-shape-survey.md` (statistical commonalities across 70 documented systems) and `03-reference-shortlist.md` (5 candidates: apple, claude, notion, mintlify, cursor).

This brief is the **single decision document** that will drive every concrete token, every skill rule, and every Storybook page in subsequent phases. Everything below is a proposal — push back on anything that feels off before we commit it to code.

---

## 1. Brand Attributes (the rezics personality)

| Attribute | Value | Why |
| --- | --- | --- |
| **Mood** | Warm, literary, restrained | Long-form reading is the core experience; cold SaaS chrome fights against that |
| **Posture** | Editorial, not promotional | rezics surfaces present *content authored by others* — the chrome should defer |
| **Density** | Dual-gear | Reader = generous breathing room; editor / admin = compact density. Same tokens, different application |
| **Voice (in copy)** | Direct, plain, low-jargon | Matches restraint of visual language |
| **Personality avoidances** | No emoji icons, no gradient hero blobs, no glassmorphism, no hand-drawn whimsy | Removes the most common SaaS clichés |

**One-sentence elevator**: *rezics looks like a printed book opened on a calm Sunday — warm paper, restrained chrome, deliberate typography, and just enough utility to get out of the reader's way.*

---

## 2. Color Strategy

### 2.1 Foundation: warm parchment dual-mode

Reject pure `#ffffff`. Adopt **warm parchment** (claude-inspired) as light canvas, **warm dark stones** as dark canvas. Light and dark are **parity tokens**, not inversions — each mode is designed independently and feels native, not "the same UI with colors flipped."

| Token role | Light value (proposal) | Dark value (proposal) | Source pattern |
| --- | --- | --- | --- |
| `bg-canvas` (page) | `#f5f4ed` parchment | `#1a1a18` warm dark stone | claude |
| `bg-surface` (raised) | `#faf9f5` ivory | `#26251e` warm graphite | claude / cursor |
| `bg-surface-elevated` (modal) | `#ffffff` paper | `#30302e` warm slate | apple / claude |
| `bg-subtle` (admin tables, code) | `#ebeae5` warm gray | `#1f1e1c` deep warm | cursor surface ladder |
| `text-primary` (ink) | `#1d1d1f` near-black | `#f0eee6` cream ink | apple ink + claude |
| `text-secondary` | `#6e6e73` neutral | `#a39e98` warm gray | apple / notion |
| `text-tertiary` (muted) | `#86868b` | `#6e6c66` | apple |
| `border-whisper` (default containment) | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.10)` | notion whisper-border |
| `border-defined` (dense tables only) | `#d2d2d7` | `#3a3937` | apple soft border |

### 2.2 Brand accent: single chromatic action color

One brand color for actions, links, and focus. **Recommendation: warm terracotta `#c96442` (claude-inspired)** — distinguishes rezics from the sea of SaaS-blue, fits the editorial / book-paper mood, has good contrast on both modes.

If terracotta feels too off-brand, fallback options ranked: warm clay `#b85d3e` → soft brick `#a04d2f` → warm coral `#d27050`.

**Hard rule**: only ONE chromatic accent. No 5-color rainbow palette. Status colors (success / warning / error) live in their own semantic group below.

### 2.3 Semantic colors

| Token | Light | Dark | Pattern source |
| --- | --- | --- | --- |
| `success` | `#1f8a65` warm teal | `#3da884` | cursor warm-tinted system |
| `warning` | `#b8732e` warm amber | `#d8943e` | warm consistent |
| `error` | `#cf2d56` warm rose | `#e34c75` | cursor (avoids cool red on warm canvas) |
| `info` | `#3898ec` (only cool color) | `#5aa9f0` | claude focus blue |

**Why warm-tinted semantics**: a cool gray border or cool red error on warm parchment looks broken (cursor's design call, validated). Status colors must respect canvas temperature.

---

## 3. Typography

### 3.1 Triad system (claude / cursor inheritance)

Three typeface roles, each with a defined purpose:

| Role | Use | Family (proposal) | Fallback chain |
| --- | --- | --- | --- |
| **Serif (editorial)** | Book content, chapter titles, long-form headings, folio bios | Source Serif 4 OR Crimson Pro | Georgia, "Times New Roman", serif |
| **Sans (UI / chrome)** | Editor toolbars, admin tables, navigation, buttons, forms | Inter | system-ui, "PingFang SC", "Microsoft YaHei", sans-serif |
| **Mono (code / data)** | Inline code, terminal blocks, IDs, hashes | JetBrains Mono OR Berkeley Mono | "SF Mono", Consolas, monospace |

### 3.2 CJK consideration

rezics is bilingual-friendly (Chinese-language platform). Latin serif faces don't render CJK glyphs — the font stack must include CJK serif/sans fallbacks (`"Source Han Serif SC"`, `"Source Han Sans SC"` or system equivalents). **Open question for user**: priority of CJK aesthetic — should we adopt Source Han families across the board for CJK-first feel, or keep Latin-primary with CJK as fallback?

### 3.3 Scale

Single 8-step type ramp, derived from a 1.250 (major third) ratio:

| Token | Size (rem) | Pixel | Use |
| --- | --- | --- | --- |
| `text-xs` | 0.75 | 12 | Captions, table cells |
| `text-sm` | 0.875 | 14 | Body in dense UI, form labels |
| `text-base` | 1.0 | 16 | Default body |
| `text-md` | 1.125 | 18 | Reader body (book content) |
| `text-lg` | 1.25 | 20 | Subsection headings |
| `text-xl` | 1.5 | 24 | Section headings |
| `text-2xl` | 1.875 | 30 | Page titles |
| `text-3xl` | 2.5 | 40 | Hero / chapter titles |

### 3.4 Line height policy (claude rule, mandatory)

| Context | Line height | Rule |
| --- | --- | --- |
| Book content (reader, > 3 paragraphs) | **1.60** | Hard requirement — defines the "literary" feel |
| Article / standard body | 1.55 | Default for most pages |
| UI labels / chrome | 1.40 | Tight enough not to waste vertical space |
| Dense tables / nav | 1.30 | Maximum compactness |

### 3.5 Weights

Stay restrained: `400` regular, `500` medium (headlines, emphasis), `600` semibold (rare — strong emphasis only). **Avoid 700+ bold** — it fights the editorial mood.

---

## 4. Spacing & Layout

### 4.1 Base unit: **8px** (matches 91% of references; matches MUI's `theme.spacing(1)`)

10-step scale (extends mintlify's clean ladder):

```
space-0  =  0
space-1  =  4px   (compact micro-gaps)
space-2  =  8px   (base — most paddings)
space-3  =  12px  (input padding-Y, small gaps)
space-4  =  16px  (card padding, default gap)
space-5  =  24px  (section internal padding)
space-6  =  32px  (section divider)
space-8  =  48px  (between sections)
space-10 = 64px  (page-level vertical rhythm)
space-12 = 96px  (chapter-level breathing)
```

### 4.2 Section rhythm

For reader and folio pages, use **48–96px vertical** between sections (mintlify pattern), with **no decorative dividers** — depth comes from spacing alone.

For admin and editor, compact: `space-4` (16px) typical, `space-5` (24px) for section breaks.

### 4.3 Container widths

- **Reader** (book content): max-width `680px` (~70 character measure for serif body)
- **Article / docs**: max-width `760px`
- **Admin tables**: full width with max `1440px`
- **Editor**: split-pane, container fluid

---

## 5. Radius

Inherit apple's purposeful tier system:

| Token | Value | Use |
| --- | --- | --- |
| `radius-xs` | 4px | Inline tags, code chips |
| `radius-sm` | 6px | Inputs, dense buttons |
| `radius-md` | 8px | **Default button radius**, chips |
| `radius-lg` | 12px | Cards, surfaces |
| `radius-xl` | 16px | Modals, large cards |
| `radius-2xl` | 24px | Hero blocks, feature cards |
| `radius-pill` | 9999px | Tags, status pills, hero CTAs |
| `radius-full` | 50% | Avatars, circular icon buttons |

**Default button radius = 8px** — convergence of apple, claude, notion. Maps to MUI `theme.shape.borderRadius` if scaled.

---

## 6. Depth & Elevation

### 6.1 Default policy: borders + spacing, NOT shadows

Inherit mintlify + notion's near-shadow-free posture. **Most surfaces should have no shadow at all.** Containment via `border-whisper` (1px at 8% opacity) and whitespace.

### 6.2 Reserved escalation: 4-layer accumulating shadow

ONLY for **modal-class elevation** (dialogs, command palette, context menus, popovers over chapters). Inherit notion's accumulating stack:

```
shadow-1: 0 1px 2px rgba(0,0,0,0.04)
shadow-2: 0 2px 4px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.04)
shadow-3: 0 4px 8px rgba(0,0,0,0.04), 0 8px 16px rgba(0,0,0,0.04), 0 16px 32px rgba(0,0,0,0.06)
shadow-modal: 4-layer accumulation, max ~0.10 total opacity
```

Cards, sections, table rows, panels: **no shadow, ever.** This is a style guide rule, not a suggestion.

---

## 7. Motion

Most reference systems don't document motion. We will be ahead of 80% of them by declaring it explicitly.

### 7.1 Duration tokens

```
motion-fast    = 120ms   (press feedback, scale on tap)
motion-base    = 200ms   (hover transitions, color shifts)
motion-slow    = 350ms   (layout shifts, panel open/close)
motion-page    = 500ms   (route transitions, page-level)
```

### 7.2 Easing tokens

```
ease-out       = cubic-bezier(0.0, 0.0, 0.2, 1)   default for entries
ease-in-out    = cubic-bezier(0.4, 0.0, 0.2, 1)   for state changes
ease-spring    = cubic-bezier(0.4, 1.4, 0.5, 1)   reserved for delight (rare use)
```

### 7.3 Press feedback (notion pattern)

Buttons: `scale(0.98)` on `:active`, `scale(1.0)` resting. 120ms. Subtle, not bouncy.

### 7.4 Reduced motion

Honor `prefers-reduced-motion: reduce` — durations collapse to `0ms`, scale transforms to identity. Hard requirement.

---

## 8. Component Conventions

### 8.1 Button shape

Default: rectangular with `radius-md` (8px). **Pill** reserved for chips, tags, hero CTAs only. **Never** mix pill and rectangular buttons in the same toolbar.

### 8.2 Inputs (borderless preference, MUI `variant="standard"`)

User has stated preference: `<TextField variant="standard">` with no outline. On focus: bottom border thickens with brand color. Filled hover state on dense forms acceptable. Outlined inputs only inside dense admin forms where field boundaries prevent confusion.

### 8.3 Cards / sections

**Whisper border only** (`border-whisper`). No `box-shadow`. No bold border. Section grouping comes from spacing + subtle background tint shift.

### 8.4 Icons

`lucide-react` only. Stroke width `1.5` default. Size `16px` (inline), `20px` (button), `24px` (standalone). **No emoji icons anywhere.**

### 8.5 MUI vs shadcn boundary

- **MUI first** for: forms (TextField, Select, Autocomplete, DatePicker), data display (Table, DataGrid), feedback (Snackbar, Dialog), navigation (Tabs, Drawer, Menu), pickers
- **shadcn supplements** for: command palette (`cmdk`), context menus, dropdowns where MUI is heavier than needed, custom composite components
- **Custom** only when both fail: complex domain components (chapter tree, reading progress strip, etc.)

---

## 9. Open Questions for User Approval

These are the calls that benefit most from your input. **Gate-A is conditional on resolving these.**

1. **Brand accent color** — terracotta `#c96442` (claude-inspired) by default. Acceptable, or do you want a different signature color? (If the rezics brand has a logo color, that wins.)
2. **CJK typography** — keep Latin-primary with CJK fallback, OR adopt Source Han Sans/Serif as the primary stack? (Affects perceived "Chinese-ness" of the product.)
3. **Serif body for reader** — adopt Source Serif 4 / Crimson Pro for book content? Or keep sans-only and use serif only for chapter titles? (Bigger commitment but more "literary.")
4. **Warm parchment vs cooler neutral** — `#f5f4ed` parchment (claude) vs `#fafafa` cool gray (mintlify) as light canvas. Warm = book-like; cool = more "modern SaaS". I'm proposing warm but it's a high-conviction call.
5. **Default radius** — 8px (proposal). Acceptable, or want softer (12px / claude) or sharper (4px / sentry)?
6. **Single brand accent enforcement** — strict (only one chromatic color across entire system) or relaxed (allow secondary highlight color for special surfaces like editor toolbar)?

---

## 10. Out of Scope for v1 (deferred decisions)

- Specific iconography style guide (variant choices within lucide)
- Loading state choreography (skeleton vs spinner per context)
- Empty state illustration system
- Marketing-page hero patterns (gradient bands, etc.)
- Print stylesheet conventions

---

## 11. What Happens After Approval

Once you approve (with answers to Section 9), Phase 3 begins:
1. Translate this brief into TypeScript token files (`package/ui/src/config/tokens/*.ts`)
2. Wire into MUI theme + UnoCSS preset
3. Smoke-test in the running app
4. Author the Claude skill that codifies the rules above for AI consumers

Total Phase 3 estimated effort: ~1 week of focused work.

---

**Awaiting**: User review + answers to Section 9.
