---
title: Zone horizontal rails — render carousel/covers through DomainCarousel
status: active
created: 2026-06-11
completed:
supersededBy:
tags: [zone, ui]
---

## Why

Zone section rails (`display: "carousel"` and `"covers"`, e.g. New Releases
on `/z/toaru` and the latest-books rail on `/z/book`) render as a bare
`<ul class="flex overflow-x-auto">` in `ZoneItemList.tsx:64-91` — no snap, no
arrows, no embla. The rest of the app standardized on
`DomainCarousel` (`@rezics/ui/composite/carousel/DomainCarousel.tsx`, used by
HorizontalBookCarousel, ActiveRealmsSection, HorizontalReviewCarousel,
HorizontalShelfCarousel, FeedRenderer, and more); the zone feature is the
outlier. Swap the rail branch to DomainCarousel.

## Durable constraints & decisions

- (comment) **One component, parameter presets.** `carousel` and `covers` both
  render through `DomainCarousel`; their difference is props, not
  implementations — `carousel`: `showArrows` + snap; `covers`: arrow-less
  `dragFree` light rail. This gives the two contract literals their first
  real semantic difference. Home: the display-variant comment atop
  `ZoneItemList`.
- (comment) Cell geometry is preserved: fixed-width cover cells
  (`w-28 sm:w-32`, `aspect-[2/3]`) with the icon placeholder fallback for
  image units without a resolved URL — that fallback behavior must survive
  the rewrite.
- (type) No contract change: `zoneSectionDisplaySchema` is untouched; this is
  a render-layer swap only.

## Tasks

- [ ] 1.1 `package/app/src/zone/components/sections/ZoneItemList.tsx`:
  replace the `carousel`/`covers` branch with `DomainCarousel`
  (deep import `@rezics/ui/composite/carousel/DomainCarousel.tsx`, matching
  app convention); map variants to prop presets per the decision above; keep
  cover cell geometry and placeholder fallback; update the header comment's
  layout-mapping description. Load the `rezics-design` skill before editing.
- [ ] 1.2 Verify in browser after `task dev`: `/z/toaru` (New Releases main
  column + sidebar covers collection — arrow-less rail must not feel heavy in
  the narrow column) and `/z/book` (latest-books rail). Give the user the
  URLs.
- [ ] 1.3 Run `task check:tokens`, `task check:convention`, `task format`.

## Out of scope

- Contract/display-schema changes or new display variants.
- Other ZoneItemList layouts (list/grid/tiles/featured/avatar-wall).
- The non-zone carousels (already on DomainCarousel).
