## Context

The book detail page (`/book/$bookId/*`) currently uses a static layout: a hero section with embedded language switching (`TranslationTabs`), four tabs (Info / Content / Reviews / Discussion), and a fixed sidebar showing the same metadata on every tab. Author information is resolved via `bookInfo.user` rather than the entity attribution model.

The page needs restructuring to improve information architecture, adopt the entity model for author display, support per-tab contextual sidebars with responsive redistribution, and move language switching to a page-wide wiki-style dropdown.

### Current Component Hierarchy

```
BookDetailLayout
├── BookHeroSection (hero + TranslationTabs + author via bookInfo.user)
└── BookDetailShell (tabs + static sidebar)
    ├── Tabs: [Info, Content, Reviews, Discussion]
    ├── Main: routed child (tab page)
    └── BookDetailSidebar (same on every tab)
```

### Key Existing Infrastructure

- `UserSettings.preferredLanguages: Array<string>` — already exists in contract and backend
- `bookQueries.detail(bookId)` — returns `BookDTO` with `translations[]` and `attributions[]`
- `bookQueries.chapterIndex(unitId)` — fetches chapter tree for a given unit
- Entity model with `UnitTranslation` — entities support per-language name/bio
- `WorkReleaseNav` — already fetches sibling releases under the same work
- `getTranslation()` helper — resolution chain: exact match → unit default → `en` → first available

## Goals / Non-Goals

**Goals:**

- Reorganize tab content into four coherent groups: Overview, Review & Shelf, Content, Community
- Replace embedded TranslationTabs with a fixed language dropdown at the tab bar's right end
- Propagate language selection page-wide (hero, descriptions, author entity, default release)
- Display author info via entity attribution model with translation support
- Add release selector in Content tab with official (translation-designated) release pinning
- Make sidebar contextual per-tab with responsive mobile redistribution (sections inline into tab content)
- Convert language preference UI from unordered chip toggles to an ordered drag-to-reorder list

**Non-Goals:**

- Backend API changes (all data is already available in existing responses)
- Changing route URLs (`/book/$bookId/info`, `/content`, `/review`, `/discussion` remain stable)
- Implementing "add to shelf" within the Review & Shelf tab (shelf actions live at the unit level — hero, individual cards)
- Persisting per-book language selection (ephemeral only)
- Changing the translation resolution algorithm itself

## Decisions

### Decision 1: Language state management — Jotai atom family at BookDetailLayout level

**Choice:** Store the selected language in a Jotai atom scoped to the book detail context (`bookLanguageAtom(bookId)`), initialized from the user's preference list matched against available translations.

**Alternatives considered:**
- *Route search param (`?lang=ja`)*: Would make language selection URL-shareable, but adds noise to every navigation within the book detail. Language is a user preference, not a page state.
- *React context*: Would work but Jotai is already the state management layer for book detail data (`bookDetailAtomFamily`). Using the same pattern is consistent.
- *Zustand store*: Overkill for a single value; Zustand is used for persistent state (chapter expansion), not ephemeral UI state.

**Initialization flow:**
1. Read `userSettings.preferredLanguages` (ordered array)
2. Get `book.translations.map(tr => tr.language)` (available languages)
3. Find first match: `preferredLanguages.find(lang => availableLanguages.includes(lang))`
4. If no match, fall through existing `getTranslation()` resolution chain

### Decision 2: Contextual sidebar — Composition via tab page props, not portals

**Choice:** Each tab page component declares its sidebar sections as a prop/slot to `BookDetailShell`. The shell renders them in the sidebar column on desktop, and each tab page conditionally renders them inline on mobile using a `useIsDesktop()` breakpoint hook.

```
// Conceptual API
<BookDetailShell
  sidebar={<>
    <MetadataPanel bookInfo={bookInfo} lang={lang} />
    <OtherEditions workUnitId={bookInfo.workUnitId} />
  </>}
>
  <Description ... />
  <MobileOnly><MetadataPanel bookInfo={bookInfo} lang={lang} /></MobileOnly>
  <QuotePreview ... />
  <MobileOnly><OtherEditions workUnitId={bookInfo.workUnitId} /></MobileOnly>
  <RemarkPreview ... />
</BookDetailShell>
```

**Alternatives considered:**
- *React portal-based slot system*: More "magical" — sidebar sections define a target slot name and portal into it. Harder to reason about, adds indirection, and MUI's `useMediaQuery` already provides clean breakpoint detection.
- *Single sidebar component with tab-awareness*: Sidebar reads the current tab and switches content. Couples sidebar knowledge to tab pages, makes it harder to keep sidebar sections co-located with their related tab content.

**Why this approach:** Sidebar sections are defined once as components, rendered twice (desktop sidebar + mobile inline) — but only one is visible at a time via CSS/breakpoint. The tab page owns the full picture of what appears and where. No portals, no magic, no runtime slot matching.

### Decision 3: Tab bar layout — Flex with scrollable tabs + fixed language dropdown

**Choice:** The tab bar is a flex container. The left portion uses MUI `Tabs` with `variant="scrollable"` and `scrollButtons="auto"`. The right portion is a fixed-position language dropdown that does not scroll with the tabs.

```
┌─────────────────────────────────────────────────────────────┐
│  ◀ [Overview] [Review & Shelf] [Content] [Community] ▶  [🌐▾]│
│  └──────────── scrollable (flex: 1) ──────────────┘  └fixed┘│
└─────────────────────────────────────────────────────────────┘
```

**Implementation:** Wrap in a flex row. Tabs get `flex: 1` with `overflow: hidden`. Language dropdown is a separate `Select`/`Menu` component with `flex-shrink: 0`.

### Decision 4: Release selector sort logic — Frontend-only, derived from existing data

**Choice:** The release selector in the Content tab derives its sorted list from two existing data sources:
1. `book.translations[]` — provides the official `unitId` per language
2. Work's release list — provides all releases under the same work (from the same query used by `WorkReleaseNav`)

Sort order:
1. Current selected language first, then other languages
2. Within each language group, translation-designated (official) release first
3. Remaining releases in default order

This is pure frontend derivation — no new API needed.

### Decision 5: Author entity resolution — Extend existing translation helpers

**Choice:** Add a helper `getEntityTranslation(entity, language)` that resolves an entity's translated name/bio for the selected language. The hero section and any author display call this instead of reading `bookInfo.user.name`.

The `bookQueries.detail()` response already includes `attributions[]` with entity data. If entity translations are not currently included in the attribution response, the `bookQueries.detail()` backend query needs to include entity translations in its Prisma select — this is the only potential backend touch, and it's a query expansion, not an API contract change.

## Risks / Trade-offs

**[Risk] Entity translations may not be included in the current `bookQueries.detail()` response**
→ Mitigation: Check the Prisma query and add `entity.translations` to the include if missing. This is a backend query change, not a contract change.

**[Risk] Dual rendering of sidebar sections (desktop + mobile) could cause duplicated data fetching**
→ Mitigation: Sidebar sections are pure display components receiving props. They don't fetch data themselves — the tab page fetches and passes down. CSS `display: none` / breakpoint hooks prevent both from rendering simultaneously.

**[Risk] Tab content redistribution may cause layout shifts on window resize**
→ Mitigation: Use CSS media queries (via UnoCSS breakpoint classes `lg:block` / `lg:hidden`) rather than JavaScript `useMediaQuery` for the show/hide logic. CSS-based approach avoids re-render flicker.

**[Trade-off] Language dropdown in tab bar uses screen space**
→ Accepted: The dropdown is compact (icon + short language code) and only expands on click. The space cost is minimal compared to the current `TranslationTabs` which renders a full tab row.

## Open Questions

- Should the Review & Shelf tab have a single continuous scroll, or a sub-section divider between reviews and shelves? Leaning toward a subtle visual divider (Divider component) without sub-tabs.
- What icon/indicator should mark the "official" release in the release selector? A star, a checkmark, or just a label like "(official)"?
