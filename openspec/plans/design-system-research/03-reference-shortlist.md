# Reference Shortlist for rezics

After reading all 70 documented systems against rezics's profile (Apple-inspired, MUI-first, content-dense, light + dark first-class, no emoji icons, borderless inputs preferred, no bordered cards for sections, book reader / wiki / publishing platform), five candidates stand out.

**Pre-hunch validation**: of the 6 names guessed up front (apple, linear-app, notion, stripe, mintlify, superhuman), four survive (apple, notion, mintlify, claude). **linear-app drops** — it is dark-only with light-mode treated as an afterthought, which violates rezics's "light + dark both first-class" requirement. **stripe drops** — its identity is built around blue-tinted shadows + financial precision, neither aligned with editorial content. **superhuman drops** — radical 2-radius binary system (8/16) is too restrictive for an editor + admin + reader spread. **claude is added** — closest content-platform precedent in the entire set (serif headlines + warm parchment + 1.60 body line-height + true light/dark token parity). **cursor is added** — only system besides claude using serif body type for editorial reading, with cream / warm-paper canvas matching rezics's tone.

The final shortlist:

1. **apple** — neutral foundation, restraint discipline, dual-mode token clarity
2. **claude** — editorial serif/sans pairing, warm content-first palette, true dual-mode
3. **notion** — content-dense product surfaces, warm-white alternation, layered shadow system for modals
4. **mintlify** — documentation-grade reading rhythm, near-shadow-free elevation, generous radii
5. **cursor** — editorial body serif + cream canvas, fine-grained surface scale for content density

---

## 1. apple

**Why it fits rezics**: rezics's stated aesthetic explicitly cites Apple. Apple's palette is the cleanest dual-mode triad in the entire reference set (`#000000` / `#f5f5f7` / `#ffffff`) plus a single blue accent — exactly the discipline rezics needs to avoid token sprawl. The dual operating modes (cinematic showcase + dense commerce) map to rezics's reader vs admin spread: same tokens, different density. SF Pro Text's micro-tracking handles dense chapter indexes; SF Pro Display handles book covers and chapter titles. The radius tier system (5 / 8–12 / 16–18 / 28–36 / pill) is more nuanced than copy-and-paste rounding and gives the editor / admin / reader each the right silhouette.

**Token snapshot**:
- Colors: `#000000` (deep canvas), `#1d1d1f` (ink), `#f5f5f7` (pale canvas), `#ffffff` (paper), `#0071e3` (action blue), `#0066cc` (link blue), `#6e6e73` (secondary), `#d2d2d7` (soft border)
- Type primary: SF Pro Display + SF Pro Text (fallback Inter / Inter Tight)
- Spacing base: 8px effective, with 2/4/6/7 micro-steps allowed
- Radius range: 5px → pill (`56px` / `100px` / `980px`) + `50%` circle
- Motion personality: undocumented in source — restrained, scale-based press feedback only

**Notable Do's / Don'ts directly applicable to rezics**:
- DO: "Reserve blue accents for genuine action and navigation semantics" — keep only one chromatic action color
- DO: "Border-led containment in dense retail contexts" — for admin tables and chapter indexes, use 1px borders, not shadows
- DO: "Use purposeful radius tiers" — different radii per component class (button vs card vs media)
- DON'T: "Overuse shadows, glow effects, or decorative gradients in core UI chrome"
- DON'T: "Treat marketing and purchase flows as separate design systems" — for rezics this means reader and editor must share tokens

---

## 2. claude

**Why it fits rezics**: this is the **single closest content-platform precedent in the entire reference set**. Anthropic Serif headlines + sans body + mono code maps 1:1 onto rezics's book-reader requirement (chapter title in serif, body in sans, inline code in mono). Body line-height of **1.60** is calibrated specifically for "reading like a book, not a dashboard" — exactly the rezics brief. Warm parchment (`#f5f4ed`) is a documented alternative to pure white for long-form reading comfort, with light/dark mode declared as parity tokens (warm parchment ↔ warm dark stones, not a generic light/dark inversion). Ring shadows + background-step elevation translates well to a borderless card approach. Single-weight serif (500) for all headlines simplifies hierarchy compared to systems that demand 3+ weights.

**Token snapshot**:
- Colors: `#f5f4ed` (parchment canvas), `#faf9f5` (ivory raised), `#141413` (dark canvas / ink), `#30302e` (dark surface), `#c96442` (terracotta brand), `#4d4c48` (charcoal warm), `#f0eee6` (border cream), `#3898ec` (focus blue — only cool color in palette)
- Type primary: serif headlines (Anthropic Serif → Georgia fallback) + sans body (Anthropic Sans → Inter fallback) + mono code
- Spacing base: 8px, scale to 30px with 80–120px section padding
- Radius range: 4px → 32px (no pill) — generously rounded, soft personality
- Motion personality: undocumented — depth via background shifts, not animation

**Notable Do's / Don'ts directly applicable to rezics**:
- DO: "Use generous body line-height (1.60) for a literary reading experience" — direct adoption recommended
- DO: "Maintain the editorial serif/sans hierarchy — serif for content headlines, sans for UI"
- DO: "Use ring shadows (`0px 0px 0px 1px`) for interactive element states instead of drop shadows"
- DO: "Alternate between light and dark sections to create chapter-like page rhythm"
- DON'T: "Use pure white (`#ffffff`) as a page background — Parchment or Ivory are always warmer"
- DON'T: "Reduce body line-height below 1.40 — the generous spacing supports the editorial personality"
- DON'T: "Use sharp corners (< 6px radius) on buttons or cards — softness is core to the identity"

---

## 3. notion

**Why it fits rezics**: the closest peer for **content-dense product UI with mass adoption**. Notion's discipline of warm-white alternation (`#ffffff` ↔ `#f6f5f4`) without harsh color breaks is exactly the kind of section rhythm rezics's chapter-index and book-folio surfaces need. Ultra-subtle 1px `rgba(0,0,0,0.1)` borders ("whisper border") instead of bold cards is rezics's stated preference verbatim. The 4-layer / 5-layer accumulating shadow stack is the right reference for occasional modal/popover elevation when ring shadows aren't enough (e.g., context menus over a chapter). And Notion's blue (`#0075de`) is the "single saturated chromatic action color" pattern that rezics already favors.

**Token snapshot**:
- Colors: `#ffffff` (white surface), `#f6f5f4` (warm white), `#31302e` (warm dark surface), `rgba(0,0,0,0.95)` (notion black text), `#615d59` (warm gray 500), `#a39e98` (warm gray 300), `#0075de` (notion blue), `rgba(0,0,0,0.1)` (whisper border)
- Type primary: Inter (system fallback) — single sans family
- Spacing base: 8px, organic scale 2 / 4 / 8 / 12 / 16 / 24 / 32 / up to 120px section gutters
- Radius range: 4px → 16px + pill (4 / 5 / 8 / 12 / 16 / pill)
- Motion personality: subtle scale on press (`scale(0.9)` active, `scale(1.05)` hover) — declared

**Notable Do's / Don'ts directly applicable to rezics**:
- DO: warm white alternation for section rhythm without color breaks
- DO: 4-layer shadow stack at very low opacities (0.01–0.05) for cards/modals — feels embedded, not floating
- DO: ratio-based interactive states (scale + opacity) over color shifts for subtle feedback
- DO: 80px+ vertical section spacing with no decorative dividers
- DON'T: hard section borders — use background color shifts and spacing only
- (rezics-specific extension): preserve Notion's discipline of "one chromatic accent for actions" but swap their blue for whatever rezics brand color is chosen

---

## 4. mintlify

**Why it fits rezics**: documentation-grade marketing chrome that practices what it preaches — **the page itself demonstrates reading comfort**. Near-shadow-free system: the entire elevation language is just `rgba(0,0,0,0.05)` borders + the rare 0.03 ambient shadow. This is the exact "minimal chrome, content first" posture rezics wants for its public folio. The 4 / 8 / 16 / 24 / pill radius scale is the cleanest geometric ladder in the reference set. Section padding of **48–96px vertical** with **24–32px card padding** is publishable as-is to rezics's chapter / page layout. Dark mode is declared as full token inversions (rare honesty in the set).

**Token snapshot**:
- Colors: `#ffffff` (page), `#fafafa` (surface tint), `#f5f5f5` (gray 100), `#e5e5e5` (border gray 200), `#0d0d0d` (near black ink), `#666666` (gray 500 muted), `#18E299` (brand green — would swap for rezics brand)
- Type primary: single sans family with mono companion
- Spacing base: 8px, scale 2 / 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96
- Radius range: 4 / 8 / 16 / 24 / pill (cleanest geometric ladder)
- Motion personality: "barely uses shadows, depth via borders + whitespace" — implied minimal motion

**Notable Do's / Don'ts directly applicable to rezics**:
- DO: 5% opacity black borders as primary depth mechanism — eliminates "card shadow" maintenance entirely
- DO: section padding 48–96px vertical for content chapters
- DO: dark mode declared as token inversions, not a separate system
- DO: pill primary buttons (matches MUI `Button shape="rounded"` extreme)
- DON'T: heavy shadows — the absence is the design decision
- DON'T: background color alternation — white-on-white throughout, depth from borders only

---

## 5. cursor

**Why it fits rezics**: cursor is the **only other system besides claude that uses serif body type for editorial reading** (`jjannon` family with `cswh` swash alternates), paired with cream canvas (`#f2f1ed`). This is the warmest, most paper-like palette in the developer-tool cluster, and bridges into rezics's book-reader use case in a way most dev-tool references can't. Multi-typeface system (CursorGothic display + jjannon serif body + berkeleyMono code + system-ui chrome) is the most sophisticated hierarchy in the set — gives rezics a template for differentiating *book content* (jjannon-equivalent serif) from *editor chrome* (sans) from *terminal/code blocks* (mono). The 5-step warm surface scale (`#f7f7f4` → `#f2f1ed` → `#ebeae5` → `#e6e5e0` → `#e1e0db`) maps directly to rezics's need for fine surface differentiation in dense reader UI without resorting to shadows.

**Token snapshot**:
- Colors: `#f2f1ed` (cream canvas), `#f7f7f4` / `#ebeae5` / `#e6e5e0` / `#e1e0db` (4-step surface ladder), `#26251e` (warm ink), `#f54e00` (cursor orange — substitute for rezics brand), `oklab(...)` borders (warm-tinted, not gray), `#cf2d56` (warm error rose), `#1f8a65` (warm success teal)
- Type primary: serif body (jjannon → Georgia) + sans display (CursorGothic → system-ui) + mono code
- Spacing base: 8px (standard)
- Radius range: documented across 18 distinct values — most flexible in the set
- Motion personality: "Thinking / Grep / Read / Edit" timeline-state colors imply subtle stateful animation but unspecified in spec

**Notable Do's / Don'ts directly applicable to rezics**:
- DO: warm cream as primary canvas, not pure white — closer to printed paper
- DO: oklab-defined border opacities for warm-tinted boundaries (avoids the "gray border on cream" feel)
- DO: 4–5 step surface scale via background tone, not shadow
- DO: serif body for editorial / story / book content; sans for editor chrome
- DON'T: cool gray borders on warm canvas — temperature must match
- DON'T: rely on a single radius — different controls deserve different rounding

---

## Combined Direction Recommendation

A rezics-specific design system would inherit:

**Foundation from apple + claude.** Use claude's warm-parchment / warm-dark dual mode as the canvas tokens — the warm cream avoids both the clinical fatigue of pure-white SaaS chrome and the harshness of OLED-black dark mode. Layer on apple's discipline: a single blue (or rezics-brand) chromatic action color, a graphite / parchment neutral triad, and apple's purposeful **radius tier system** (5 → 8 → 12 → 16 → pill) so a chapter card, a dense table cell, and a hero CTA each have the silhouette they deserve. Take claude's serif/sans pairing wholesale — serif (Crimson Pro, Source Serif, or similar free Anthropic-Serif equivalent) for chapter titles and book-content headings; sans (Inter or system-ui) for all editor / admin / nav chrome; mono for inline code blocks. Body line-height of **1.60** is mandatory for any block longer than three paragraphs, falling back to 1.50 for dense tables and 1.40 for nav / chrome.

**Density and chrome from notion + mintlify + cursor.** For the layered surfaces a content + admin + editor app needs, use notion's whisper-border + warm-white alternation pattern — this lets rezics achieve "no bordered cards" without losing structure, since 1px `rgba(0,0,0,0.08)` borders are visually closer to absent than present. Reserve mintlify's near-shadow-free policy as the default (everything is borders + whitespace), and only escalate to notion's accumulating 4-layer shadow stack for **modal-class** elevation (command palette, context menus, dialogs over chapters). Cursor's 5-step warm surface ladder is the cleanest precedent for the *editor* and *admin tables* — when rezics needs three or four background steps in dense UI, layer them as warm cream tones, never as gray cards stacked with shadows. Adopt cursor's oklab-tinted borders so containment lines on parchment match the canvas temperature. Pill geometry stays reserved for chips, tags, and the rare hero CTA — the workhorse button radius is **8px** (apple, notion, claude all converge here), which is also MUI's `borderRadius: 1` token. For the borderless input requirement, lean on MUI's `variant="standard"` + filled hover state — none of the references model this perfectly, so this becomes a rezics-specific convention rather than a borrowed pattern. Motion is the open frontier: declare 200ms ease-out for hover, 350ms ease-out for layout shifts, and 120ms scale-press feedback (notion's documented pattern) — this puts rezics ahead of 80% of the reference set on motion rigor.
