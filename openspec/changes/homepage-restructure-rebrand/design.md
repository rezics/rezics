## Context

### Current State

The global homepage at `/` contains a mix of cross-platform and book-specific sections. The `/book` route renders `BookLibPage` — a search/listing page. The hero and footer reference "Library Book" / "Library.Book" branding. The platform is expanding to support multiple library types (books, games, media), requiring the homepage to serve as a platform portal rather than a book-centric page.

### Current Route Structure

```
/                    → Home.tsx (mixed cross-platform + book sections)
/book                → BookLibPage (search/listing)
/book/search         → BookLibPage (same component, redundant)
/book/new            → NewBookPage
/book/$bookId/...    → Book detail routes
```

### Target Route Structure

```
/                    → Home.tsx (REZICS portal — cross-platform sections only)
/book                → BookHomePage (NEW — curated book library homepage)
/book/search         → BookLibPage (full search with filters)
/book/new            → NewBookPage (unchanged)
/book/$bookId/...    → Book detail routes (unchanged)
```

## Goals / Non-Goals

**Goals:**
- Global homepage becomes a REZICS platform portal with cross-platform content
- `/book` becomes a curated book library homepage with book-specific editorial sections
- Book search moves exclusively to `/book/search`
- All branding updated from "Library Book" / "Library.Book" to "REZICS"
- Review and realm discovery sections added to global homepage

**Non-Goals:**
- Creating game or media library homepages (those remain "Coming Soon")
- Redesigning existing components — reuse section components, just move them between pages
- Backend changes — this is purely frontend routing and component restructure
- Changing the search component itself — `BookLibPage` moves routes but keeps its implementation

## Decisions

### Decision 1: Split Home.tsx into two pages by moving sections

**Choice:** Create a new `BookHomePage` component that receives the book-specific sections currently in `Home.tsx`. The global `Home.tsx` keeps cross-platform sections and gains review/realm sections.

**Section redistribution:**

| Section | Current (/) | Target (/) | Target (/book) |
|---------|-------------|------------|-----------------|
| Hero carousel | Yes | Yes (rebranded REZICS) | No (book-specific hero) |
| Library cards | Yes | Yes | No |
| Active Realms | Yes | Yes | No |
| Announcements | Yes | Yes | No |
| Trending Shelves | Yes | Yes | No |
| Trending Reviews | Yes | Yes | No |
| Quick Access Tags | Yes | No | Yes |
| New Books (tabbed) | Yes | Yes (preview, 3-5 items) | Yes (full, 12 items) |
| Trending Books | Yes | No | Yes |
| Trending Quotes | Yes | No | Yes |
| Review discovery | No | Yes (new) | No |
| Realm discovery | No | Yes (new) | No |

The global homepage keeps the "latest works" (New Books) section as a teaser with fewer items and a "See all" link to `/book`.

**Rationale:** Minimal code change — sections are already self-contained components with their own data fetching. Moving them between pages is composition, not rewrite.

### Decision 2: TanStack Router file-based routing for new book homepage

**Choice:** 
- `_mainLayout/book/index.tsx` — Currently renders `BookLibPage`. Change to render `BookHomePage`.
- `_mainLayout/book/search.tsx` — Already exists, currently renders `BookLibPage`. Keep as-is (or ensure it renders `BookLibPage` if it doesn't already).

**Rationale:** TanStack Router's file-based routing makes this straightforward. The `index.tsx` file maps to `/book`, `search.tsx` maps to `/book/search`. No route configuration changes needed.

### Decision 3: BookHomePage follows established section composition pattern

**Choice:** `BookHomePage` follows the same pattern as `Home.tsx` — a vertical stack of Paper-wrapped section components, each handling its own data fetching.

```tsx
// BookHomePage.tsx
<Stack spacing={3}>
  <BookHomeHeroSection />      {/* Book-specific hero with search bar → /book/search */}
  <QuickAccessLinks />         {/* Tag chips for quick search */}
  <NewBookSection limit={12} />
  <TrendingBookSection />
  <TrendingQuoteSection />
</Stack>
```

**Rationale:** Consistent with existing architecture. No new patterns introduced.

### Decision 4: Rebrand hero and footer in place

**Choice:** Update `Home.tsx` hero kicker from "Library Book" to "REZICS". Update `MainLayoutFooter.tsx` brand text from "Library.Book" to "REZICS". Update i18n keys where the brand name is referenced.

**Rationale:** These are string changes in existing components. The hero component structure remains the same.

### Decision 5: Review and realm sections on global homepage follow existing section pattern

**Choice:** Create `RecentReviewsSection` and `RealmDiscoverySection` (or reuse `ActiveRealmsSection` and `TrendingReviewsSection` which already exist in `home/section/`). These are already rendered on the homepage — the task is to ensure they're prominent after book-specific sections are removed.

**Rationale:** These section components already exist and are already rendered on the homepage. The change is about what gets removed (book-specific sections), not what gets added.

## Risks / Trade-offs

**[Breaking bookmarks to /book]** → Users who bookmarked `/book` expecting the search page will land on the book homepage instead. Mitigation: The book homepage will include a prominent search bar that routes to `/book/search`, so users can still search with one click. The `/book/search` route already exists and will continue to work.

**[Section component dependencies on parent page]** → Some sections may have implicit dependencies on the page they're rendered in (e.g., shared query context). Mitigation: Existing sections are self-contained with their own `useQuery` hooks — this is already verified by reading the code.

**[SEO / link sharing]** → External links to `/book` will show different content. Mitigation: The new content at `/book` is richer (curated homepage vs raw search listing), which is generally better for link sharing.
