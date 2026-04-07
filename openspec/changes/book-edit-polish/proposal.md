# Book Edit Polish

## Problem

The book-edit-overhaul introduced several visual regressions:

1. **Bordered inputs** — shadcn `Input` has visible borders; the text inputs should be borderless/minimal
2. **MUI over-removal** — MUI TextField was the target for replacement, not MUI Button/Dialog/etc. Buttons should stay MUI where they were.
3. **Card borders on sections** — Wrapping each metadata section in a bordered `<Card>` looks heavy. Should follow Apple's clean, borderless section design.
4. **Chapter tree height too low** — Tree doesn't fill available vertical space, feels cramped
5. **Leaf nodes need card rendering** — Per the reference screenshot, leaf chapters should render as cards showing title, date, word count, and actions — not flat tree rows

## Solution

1. Replace shadcn Input with borderless inputs (bottom-border-only or bg-muted pattern)
2. Restore MUI Button where it was before; keep shadcn for new UI only
3. Remove Card wrappers from info sections — use Apple-style section headings with spacing, no borders
4. Fix tree height to fill viewport
5. Render leaf nodes as multi-line cards with metadata, using variable row height in react-arborist
