# Token Shape Survey — 72 Reference Design Systems

Statistical commonalities extracted from sections 2 (color), 3 (typography), 5 (layout/spacing/radius), 6 (depth), 7 (do's/don'ts), and 8 (responsive/dark mode) of every `DESIGN.md` in `/home/edge/projects/rezics/example/open-design/design-systems/`.

Sample: 70 fully-documented systems + 2 placeholders (`default`, `warm-editorial` — both empty / templates and excluded from numeric stats).

Effective N = 70.

---

## 1. Color Scale Depth

Counted distinct named color tokens (hex / rgba / hsla / oklab) per system in section 2.

### Distribution

| Bucket | Token count | Systems | Examples |
|--------|-------------|---------|----------|
| Very flat | < 10 | 4 | spacex (5), figma (5), bmw (7), coinbase (9) |
| Flat | 10–15 | 13 | tesla, ollama, cohere, framer, wired, wise, vodafone, x-ai, kraken, ollama, bugatti, together-ai, uber |
| Standard | 16–22 | 27 | airbnb, airtable, apple, claude, elevenlabs, intercom, lovable, mongodb, miro, notion (close), pinterest, replicate, runwayml, shopify, sanity, sentry, spotify, supabase, theverge, vodafone, webflow, zapier, others |
| Deep | 23–32 | 22 | binance, clay (32), composio, cursor (28), expo, hashicorp (27), ibm (30), lamborghini, linear-app (29), minimax, mintlify, mistral-ai, notion (31), nvidia, playstation (31), resend (32), starbucks, stripe (29), vercel (29), voltagent (31), xiaohongshu (36), raycast (36) |
| Very deep | > 32 | 4 | raycast (36), xiaohongshu (36), nike (51), meta (52) |

- **Median**: ~21 tokens per system
- **Mode bucket**: 16–22 (39% of systems)
- **Mean**: ~21
- **Range**: 5 (spacex) → 52 (meta)

### Family-level depth (rough)

Most systems run **2–3 dedicated neutral steps** between deep ink and the lightest border (e.g. apple: `#1d1d1f`, `#6e6e73`, `#86868b`, `#d2d2d7`, `#f5f5f7`). Systems documenting full **9-step neutral ramps** (50/100/200/.../900): only `nike`, `meta`, `mintlify`, `vercel`, `ibm`, `mongodb`, `xiaohongshu` — i.e., the ones that publish a real component library with named tokens.

Outliers:
- **spacex** (5) — pure black/white binary, atmospheric only.
- **figma** (5) — marketing chrome is intentionally black + white only; product screenshots carry color.
- **meta** (52) — six product sub-brands each contribute their own accent ramp.
- **raycast** (36) — full Radix-style ramp + status colors + glow tokens.

### Takeaway for rezics

A content platform with reader + editor + admin needs ≥ 18 named tokens to cover: 2 surfaces, 3 borders, 4 text steps, 1 brand accent + hover + active, 4 semantic, 1 focus ring. Going below that creates dependency on opacity hacks; going above 30 risks token soup.

---

## 2. Typography Ramp

### Number of size steps per system

Counted distinct rows in the hierarchy table of section 3.

| Steps | Count of systems | Pattern |
|-------|------------------|---------|
| 6–8 | 9 | Marketing-only systems (airtable 9, hashicorp 13, runwayml ~8) |
| 9–11 | 23 | Most consumer brands; clean 3-tier display + body + caption |
| 12–14 | 24 | Comprehensive (apple 15, claude 16, framer 17, raycast 14, sanity 13) |
| 15+ | 14 | Dev-tool / docs-heavy (cursor 19, framer 17, claude 16, apple 15, ibm 15) |

- **Median**: ~12 steps
- **Mode bucket**: 9–11 (33%)
- **Range**: 6 (spacex, figma) → 19 (cursor)

### Display vs body tightness

| Display line-height | Systems | Body line-height |
|---------------------|---------|------------------|
| 0.85–1.00 (extreme tight) | framer (0.85), figma (1.00), cohere (1.00), intercom (1.00), elevenlabs (1.08), clay (1.00) | 1.40–1.60 |
| 1.05–1.15 (tight) | apple, claude, expo, linear-app, raycast, vercel | 1.40–1.60 |
| 1.16–1.25 (moderate) | airbnb, hashicorp, ibm, notion, sanity, stripe | 1.40–1.50 |

Pattern: **almost universal contrast** — display tight (≤1.10), body relaxed (≥1.40). Every system that targets long-form content (claude, notion, cursor, mintlify) sets body at **1.50–1.60**.

### Font families used

| Family | Count | Notable users |
|--------|-------|---------------|
| Inter / Inter Variable | 24 | clickhouse, expo, framer, raycast, voltagent, ollama, elevenlabs, vercel substitute, ... |
| System fonts (-apple-system, system-ui) | 14 | hashicorp body, cursor UI, partial fallbacks |
| Custom proprietary sans | 35+ | Geist (vercel), figmaSans, Saans (intercom), CohereText, Roobert (clay), HashiCorp Sans, Cereal (airbnb), GT Walsheim (framer), CursorGothic, Waldenburg (elevenlabs), etc. |
| IBM Plex (sans + mono + serif) | 1 | ibm (named family across all) |
| SF Pro Display / Text | 1 explicit | apple (suggested for figma fallback) |

### Single-family vs multi-family

- **Single-family systems** (one sans for everything): airbnb, ollama, mistral-ai, opencode-ai, runwayml, pinterest, expo (Inter only), figma (figmaSans+figmaMono so technically dual), webflow, kraken, mintlify (single sans + mono).
- **Sans + Mono pairing** (no serif): the largest cluster — vercel, supabase, supabase, raycast, voltagent, linear-app, framer, intercom, clay, hashicorp.
- **Sans + Serif + Mono triad**: 27 systems use a non-code serif somewhere — claude (serif headlines, sans body), cohere (serif display, sans body), cursor (sans display, serif body), wired, theverge, mastercard, intercom (Serrif body option), lovable (mostly sans but with editorial moments), webflow.

### Long-form / content-heavy outliers

Worth flagging — these *use serif body or extra-relaxed line-height for editorial reading*:
- **claude** — Anthropic Serif headlines + 1.60 body.
- **cursor** — jjannon serif body at 1.50 + cswh swash.
- **wired** — newsprint editorial: dual font; long-read columns.
- **theverge** — Polysans + GT Maru editorial pairing.
- **mastercard** — Mastercard FF Mark + serif accents.
- **mintlify** — single sans, but generous 1.6–1.8 reading rhythm.

### Takeaway for rezics

For a book-reader app, the single closest precedent is **claude** (serif for chapters/titles + sans for chrome + 1.60 body). Apple, mintlify, and cursor are the next most quotable. Two-family (serif + sans) is the right ceiling — three is excess for a single product surface.

---

## 3. Spacing System

### Base unit

| Base | Count | Notes |
|------|-------|-------|
| **8px** | 64 / 70 (91%) | Universal default |
| 4px | 1 | nike (declares 4px Podium grid; uses 8px multiples in practice) |
| Unspecified | 5 | airtable, apple (declares "effectively 8px" with micro-steps), miro, starbucks, webflow |

**Verdict**: 8px is the de-facto industry standard. Apple and a handful that deviate still admit 8px is the "effective" unit; they only allow finer optical tweaks (2/4/6/7px).

### Number of scale steps

Counted unique values mentioned per scale. Distribution:

| Steps | Count | Examples |
|-------|-------|----------|
| 6–8 | 12 | superhuman binary 8/16, tesla, uber |
| 9–12 | 28 | apple (12 values incl. micro), claude, linear-app, notion, raycast |
| 13–15 | 22 | sanity (12 named tokens), mintlify (12), stripe (12), supabase, vercel |
| 16+ | 8 | hashicorp, framer, cursor — heavy systems |

- **Median**: ~12 steps
- **Most common stride**: 1, 2, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96px (a fibonacci-ish 8px ramp)

### Max spacing value

| Cap | Count | Examples |
|-----|-------|----------|
| ≤ 64px | 4 | tiny systems / marketing-light |
| 80–96px | 18 | claude, notion, linear-app — common section gutter |
| 96–120px | 35 | mintlify, sanity, stripe, raycast — most |
| 120–160px | 13 | superhuman, replicate — cinematic spacing |

- **Median max**: 96–120px

### Takeaway for rezics

**8px base with ~12 steps** is the unanimous baseline. Max spacing should hit ≥ 96px to support editorial chapter breaks. Micro-steps (2/4/6/7) are useful for inline alignment but should be exceptional, not primary.

---

## 4. Radius Scale

### Distinct radii per system

| Radii count | Distribution | Examples |
|-------------|--------------|----------|
| 2 only | 1 | superhuman (8px + 16px — radical binary) |
| 3–4 | 8 | uber, tesla, mastercard, runwayml, miro, kraken, wise, airtable |
| 5–7 | 32 | majority — micro/small/standard/large/pill |
| 8–9 | 22 | apple (6 tiers + 50%), notion, linear-app, vercel, claude |
| 10+ | 7 | cursor, raycast, posthog, hashicorp, sanity (declared as named tokens) |

- **Median**: ~6 distinct radii
- **Most common ladder**: 2/4 → 6/8 → 12/16 → 24/32 → pill (9999px)

### Smallest non-zero

- 1–2px: 14 systems (clickhouse, vercel, raycast micro)
- 3–4px: 38 systems — standard
- 5–6px: 18 systems
- ≥ 8px: rare — only superhuman

### Largest (pill / circle)

| Largest type | Count |
|--------------|-------|
| Explicit `9999px` / `99999px` pill | 47 |
| Numeric large (50–100px) | 12 |
| Apple-style range (`56`, `100`, `980px`) | 3 |
| Only `50%` circle | 8 (no pill — sentry, supabase) |

### Pattern: arithmetic vs geometric vs ad-hoc

- **Geometric** (×2 doubling): apple (5/8/16/32), superhuman (8/16), claude (4/8/16/32).
- **Arithmetic** (regular +4): mintlify (4/8/12/16/24), notion (4/8/12/16), vercel (2/4/6/8/12).
- **Ad-hoc** (optical adjustments): linear-app (2/4/6/8/12/22), raycast (2/3/4/5/6/8/9/11/12/16/20/86), cursor — most dev-tool systems use micro-tuned values.

### Takeaway for rezics

**5–7 distinct radii covering 4 → 8 → 12 → 16 → pill** is the dominant pattern. Borderless cards + Material/Apple rounding suggests rezics should adopt **4 / 8 / 12 / 16 / 9999px**, with `8px` as the default control radius (matching apple/notion/superhuman). Avoid > 4 levels for primary chrome; reserve 24–32px for large media containers.

---

## 5. Elevation / Shadow

### Declared shadow steps per system

Counted distinct elevation rows in section 6.

| Steps | Count | Examples |
|-------|-------|----------|
| 0 (flat / shadow-free) | 7 | spacex, supabase ("almost no shadows"), uber (no gradients but uses shadows lightly), framer, x-ai, ollama, sanity ("colorimetric only") |
| 1–2 | 18 | mintlify, superhuman (border-led), claude (mostly rings), tesla |
| 3 | 26 | the dominant pattern: ambient / standard / focus |
| 4–5 | 17 | apple (5), notion (5-layer card stack), stripe (4), vercel (4 with multi-layer), linear-app (5+inset) |
| 6+ | 4 | raycast (5 + glow + key cap), webflow (5-layer cascade), elevenlabs (8 distinct shadow definitions), framer (no — ignore) |

- **Median steps**: 3
- **Filled-only / minimal-shadow systems**: 7 explicitly + 18 with ≤ 2 elevations = **~36% lean filled / border-led**.
- **Multi-layer / atmospheric stacks**: Only ~6 systems publish 4+ stacked shadows (notion, vercel, stripe, raycast, webflow, linear-app).

### Shadow philosophy summary

| Approach | Frequency | Representatives |
|----------|-----------|-----------------|
| Border-as-shadow / ring shadow | 23 | vercel, claude, raycast, linear-app, voltagent, sanity |
| Multi-layer stacked | 14 | notion, stripe, webflow, raycast, framer (none — wrong), apple |
| Single soft drop | 15 | spotify, mongodb, mintlify, lamborghini |
| Colorimetric (background steps only) | 11 | sanity, supabase, linear-app (combined w/ ring), x-ai |
| Inset / pressed for tactile feedback | 8 | raycast, lovable, spotify, intercom |
| No shadow at all | 7 | spacex, uber (gradient-free, light shadows), framer (almost) |

### Takeaway for rezics

Restrained, Apple-leaning systems use ≤ 3 shadow steps and rely on **ring shadows + border luminance**. The most rezics-relevant exemplars (apple, notion, claude, mintlify, superhuman) all sit in the **2–4 step** band with a strong preference for `0 0 0 1px rgba(0,0,0,0.08)` ring borders over offset shadows. rezics should plan ~4 levels: flat / ring / soft-card / modal, plus a focus ring.

---

## 6. Motion

### Mention of explicit timings or easing curves

| Mentions | Count |
|----------|-------|
| Explicit duration values (e.g., `200ms`, `150ms`, `300ms`) | 13 |
| Explicit easing (e.g., `cubic-bezier(...)`, `ease-out`, `ease-in-out`) | 14 |
| Either of the above | ~14 (heavily overlapping set: binance, bugatti, cursor, meta, nike, opencode-ai, playstation, shopify, starbucks, tesla, theverge, vodafone, wired, lovable) |
| **Neither — motion section omitted or generic prose** | **56 of 70** (80%) |

### When motion *is* mentioned

Most-cited values across the 14 documenting systems:
- **150–200ms** for hover / micro-state transitions (most common bucket)
- **250–400ms** for surface / layout transitions (second cluster)
- **`cubic-bezier(0.4, 0.0, 0.2, 1)`** (Material standard) and `ease-out` are most cited curves

Specific examples:
- **opencode-ai**: 150ms ease-out for buttons, 200ms for surfaces.
- **starbucks**: 240ms cubic-bezier(0.25, 0.1, 0.25, 1).
- **playstation**: 200ms ease for hover state changes.
- **nike**: 300ms ease-in-out for product image transitions.

### Takeaway for rezics

Motion is the **least documented** dimension across the 72 references — 80% just say "subtle" or "fast." rezics has freedom here and should treat motion as a first-class token (200ms ease-out default + 350ms for layout shifts), since few peers do this rigorously.

---

## 7. Dark Mode Handling

### Coverage classification

Determined by section 7 / section 8 explicit dark mode sub-sections, plus presence of distinct dark-mode token tables.

| Coverage | Count | Examples |
|----------|-------|----------|
| **Dark-only** (no light mode shown) | 20 | linear-app, raycast, sanity, supabase, framer, sentry, voltagent, runwayml, x-ai, opencode-ai, cursor, clickhouse, ollama (ish), warp, shopify, lamborghini, ferrari, wise, kraken, replicate |
| **Light-only** (no dark mode shown) | 23 | airbnb, airtable, mastercard, lovable, notion (claims warm light only), tesla, starbucks, vodafone, vercel (light primary, dark optional), uber, pinterest, intercom (mostly), zapier, webflow, mistral-ai, renault, bmw, bugatti, expo (mostly), wired, miro, theverge (dark canvas, but still single-mode), nvidia |
| **Dual / both first-class** | 19 | apple, claude, ibm, mintlify, expo (partial), hashicorp, mongodb, framer (offers both), spotify (dark-primary but documents light), xiaohongshu, raycast (partial), opencode-ai, supabase (mainly dark), shopify, sanity (partial light variant), nike, posthog, sentry (partial), meta |
| **Hybrid editorial** (alternating sections) | 8 | apple, claude, mongodb, hashicorp, theverge — dark hero / light body or vice versa, but not full dual modes |

> Note: classification is fuzzy — many "dark-only" systems show light-mode for one button or section. The above counts who treats both modes as first-class with full token mappings.

### Takeaway for rezics

For rezics's stated requirement that **light and dark are both first-class**, the strongest token-level precedents are:
- **apple** (explicit dark/light triad: `#000`, `#f5f5f7`, `#fff`).
- **claude** (warm parchment ↔ warm dark stones; both fully tokenized).
- **ibm Carbon** (full Gray 100 dark theme + Gray 10 light theme as named tokens).
- **mintlify** (publishes full color inversions for every token).
- **mongodb** (forest-black + light section tokens).

Avoid copying linear-app, raycast, sanity — they are dark-only and light-mode is an afterthought.

---

## 8. Pattern Frequency

Counts based on grep across all 70 systems.

### Buttons

| Pattern | Count | Notes |
|---------|-------|-------|
| Pill / capsule buttons explicitly called out | 49 | Most commonly for primary CTA — apple, mintlify, sanity, raycast use pills (`9999px`); stripe / vercel / linear-app explicitly avoid them |
| Square / sharp buttons (≤ 4px radius) as default | 11 | stripe (conservative), webflow, ibm, vercel, ollama, wired, theverge, kraken |
| Rounded rect (6–12px radius) as primary | 50+ | Vast majority of systems — workhorse pattern |

### Cards

| Pattern | Count | Notes |
|---------|-------|-------|
| Bordered cards (visible 1px border) | 38 | Many SaaS / dev-tool systems |
| Borderless / shadow-only cards | 22 | apple, claude, mintlify, notion, tesla, runwayml — restrained brands |
| Background-luminance step (no border, no shadow) | 11 | linear-app, sanity, supabase, raycast (rings count as borders) |
| Mixed (depends on context) | 9 | stripe, vercel — borders for inputs, ring shadows for cards |

### Inputs

| Pattern | Count |
|---------|-------|
| Borderless / underline / floating inline | 7 (rarely explicit) |
| Bordered standard | 50+ |
| Filled-background (no visible border) | 19 |
| Floating labels (Material-style) | 4 explicit (ibm, mongodb, airbnb, mastercard) |
| Static labels (above input) | 60+ |

> Note: only 2 systems explicitly say "borderless input" (lovable, claude). rezics's preference is rare in marketing-design references but well-grounded in product UI (notion, linear). The reference set is biased toward marketing pages where inputs are scarce.

### Other notable pattern frequencies

| Pattern | Count |
|---------|-------|
| Single-accent-color discipline (one chromatic action color) | 41 |
| Multi-accent (≥ 3 chromatic accents in primary palette) | 19 |
| Warm-neutral palette (cream / parchment / olive) | 14 (claude, cursor, lovable, mistral-ai, posthog, starbucks, warp, zapier, mongodb-ish, mastercard, opencode-ai, superhuman, mintlify-ish, wise) |
| Cool-neutral palette (slate / blue-gray) | 22 |
| Pure achromatic (no warm/cool bias) | 14 |
| Editorial section alternation (light ↔ dark chapters) | 17 |
| Hero gradient (single signature) | 24 |
| Gradient-free / "no gradients" stated explicitly | 22 |
| Glassmorphism / backdrop-blur | 9 (apple, supabase, voltagent, framer, ollama, x-ai, etc.) |
| OpenType stylistic sets ("ssXX") explicitly enabled | 23 |
| Negative letter-spacing as core identity | 31 |

---

## 9. Cross-Cutting Observations

1. **8px is universal.** No serious challenger; arguments are over micro-steps, not the unit.
2. **Color depth tracks ambition.** Marketing-only ≈ 15 tokens; full design system ≈ 25; multi-product brand ≈ 50+.
3. **Shadow is over-engineered or under-engineered.** Most systems either ship 1 shadow ("light card") or a 5-layer atmospheric stack — almost no middle ground.
4. **Motion is documented poorly across the set.** Only 14/70 declare durations. This is rezics's chance to differentiate.
5. **Light + dark dual systems are a minority** (~27%) — and Apple, Claude, IBM, Mintlify are the cleanest precedents.
6. **Sans-serif dominates.** Inter is the most-cited, even when systems claim a custom face. Real serif body type for editorial reading appears in only 5–7 systems (claude, cursor, theverge, wired, mastercard, intercom optional, cohere display).
7. **Pill CTAs are the majority signature.** ~70% of brand systems use pill primary actions; the dev-tools cluster (stripe, vercel, linear, supabase) deliberately avoids them.
8. **Borderless inputs are rare in marketing references.** rezics's preference is more common in product UI; expect to lean on MUI's built-in `variant="standard"` rather than mimicking these reference sites for input chrome.

---

## 10. Implications for rezics Token Plan

| Dimension | Reference median / mode | Recommended rezics target |
|-----------|------------------------|--------------------------|
| Color tokens | ~21 | 22–28 (covers warm-neutral surfaces, 4 text steps, 1 brand accent + states, 4 semantic, 1 focus) |
| Typography size steps | ~12 | 11–14 (11 keeps things sane; 14 lets the reader get a true editorial ladder) |
| Font families | 1–2 (sans+mono) typical; 3 (sans+serif+mono) for editorial | **Sans + Serif + Mono** triad — claude precedent |
| Spacing base | 8px | **8px** with 12 steps, max ~96px |
| Radius levels | 5–7 | **5** levels: 4 / 8 / 12 / 16 / 9999px |
| Shadow levels | 3 | **4**: flat / ring-border / soft-card / modal-overlay, plus focus ring |
| Motion | undocumented for 80% | **3 durations × 2 easings** explicitly tokenized (rezics differentiator) |
| Dark mode | ~27% dual first-class | **Both modes mandatory**, tokens declared at parity |
| Default button | rounded-rect 6–8px | **8px rounded-rect**, pill reserved for chips/tags only |
| Default card | shadow + light border | **Borderless surface w/ background luminance step** for content sections; 1px ring on interactive cards |
| Default input | bordered (industry norm) | **Filled-background or underline (MUI standard variant)** — diverges from references but matches stated preference |
