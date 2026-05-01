# Open-Design Reference Inventory

**Source clone**: `/home/edge/projects/rezics/example/open-design/` (sibling, not git-tracked)
**Confirmed**: 72 reference design systems (count matches README claim).

## Layout

```
../example/open-design/
├── design-systems/
│   ├── README.md                     # Index/intro
│   ├── apple/DESIGN.md               # 1 of 72
│   ├── linear-app/DESIGN.md
│   ├── ...
│   └── zapier/DESIGN.md
├── prompt-templates/                 # 31 visual skills (decks, dashboards, etc.) — out of scope here
├── apps/ packages/                   # The application itself — out of scope here
```

Each design system is **a single `DESIGN.md` file**, ~250–370 lines, structured with consistent section headers:

```
## 1. Visual Theme & Atmosphere
## 2. Color Palette & Roles
## 3. Typography Rules
## 4. Component Stylings
## 5. Layout Principles
## 6. Depth & Elevation
## 7. Do's and Don'ts
## 8. Responsive Behavior
## 9. Agent Prompt Guide
```

The header at the top includes a one-line `> Category: ...` tag (e.g., `Media & Consumer`, `Developer Tools`, etc.) that helps clustering.

## Why this matters for our plan

- **Machine-readable**: pure markdown; sub-agent can parse all 72 in one pass.
- **Comparable**: identical section structure across all systems → statistical extraction (T2.1) is feasible.
- **Self-describing categories**: the `Category:` line eliminates needing to manually classify.

## Full system list (72)

airbnb, airtable, apple, binance, bmw, bugatti, cal, claude, clay, clickhouse, cohere, coinbase, composio, cursor, default, elevenlabs, expo, ferrari, figma, framer, hashicorp, ibm, intercom, kraken, lamborghini, linear-app, lovable, mastercard, meta, minimax, mintlify, miro, mistral-ai, mongodb, nike, notion, nvidia, ollama, opencode-ai, pinterest, playstation, posthog, raycast, renault, replicate, resend, revolut, runwayml, sanity, sentry, shopify, spacex, spotify, starbucks, stripe, supabase, superhuman, tesla, theverge, together-ai, uber, vercel, vodafone, voltagent, warm-editorial, warp, webflow, wired, wise, x-ai, xiaohongshu, zapier

## Pre-shortlist hunch (for T2.2)

Based on rezics's known preferences (Apple-inspired, MUI-first, borderless, content-dense, no emoji icons), strong candidates likely include:
- **apple** — direct aesthetic match
- **linear-app** — content-dense, restrained chrome, dev-tool peer
- **notion** — content-dense, editorial, document-first
- **stripe** — quiet chrome, blue accent system, restrained
- **mintlify** — documentation-first, pure typography
- **superhuman** — dense productivity UI, restrained

To be validated by the actual T2.2 sub-agent pass.
