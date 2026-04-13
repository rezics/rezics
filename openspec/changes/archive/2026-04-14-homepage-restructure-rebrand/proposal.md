## Why

REZICS is evolving from a single book library into a multi-library platform (books, games, media). The current routing treats `/book` as the book search page and the global homepage (`/`) contains book-specific content sections (New Books, Trending Books, Trending Quotes) mixed with cross-platform sections. The branding still references "Library Book" / "Library.Book" in the hero and footer. This structure doesn't scale — each library type needs its own homepage, and the global homepage should serve as a platform portal across all domains.

This change restructures the routing so `/book` becomes the book library homepage (curated, editorial), search moves to `/book/search`, and the global homepage is slimmed down to cross-platform content under the REZICS brand. This depends on `fix-book-i18n-pipeline` being completed first so content actually renders during development.

## What Changes

- **Global homepage (`/`) becomes REZICS portal:**
  - Hero section rebranded from "Library Book" to REZICS
  - Remove book-specific sections (New Books, Trending Books, Trending Quotes, Quick Access Tags)
  - Keep cross-platform sections: Library Cards, Active Realms, Trending Reviews, Trending Shelves, Announcements
  - Add review and realm discovery sections following the existing section pattern (self-contained data fetching, header with "More" link)

- **New book library homepage (`/book`):**
  - **BREAKING** — `/book` changes from BookLibPage (search) to a curated homepage
  - Receives book-specific sections from the old global homepage: New Books (tabbed), Trending Books, Trending Quotes, Quick Access Tags
  - Book-specific hero/featured section
  - Prominent link/search bar routing to `/book/search`

- **Search moves to `/book/search`:**
  - Current `BookLibPage` component moves to the `/book/search` route
  - Full search with filters, sort, and pagination

- **Footer rebrand:**
  - "Library.Book" → "REZICS" in `MainLayoutFooter.tsx`
  - Update brand description to reflect multi-library identity

- **Navigation updates:**
  - Update `MainNavigation.tsx` links if needed
  - Ensure breadcrumbs and "More →" links from homepage sections point to correct routes

## Capabilities

### New Capabilities

- `book-library-homepage`: The curated book library landing page at `/book` with editorial sections, distinct from the search page at `/book/search`.

### Modified Capabilities

- `homepage-ecosystem`: Global homepage sections change — book-specific content removed, review/realm sections added, branding updated to REZICS. Search route separation enforced.

## Impact

- **`package/app`** — Route files restructured: new route at `_mainLayout/book/index.tsx` (book homepage), `BookLibPage` remapped to `_mainLayout/book/search.tsx`. Home page (`_mainLayout/index.tsx`) sections reduced. Footer and hero components updated. New `BookHomePage` component created.
- **Navigation** — `/book` in nav now points to book homepage instead of search. Users searching for books navigate to `/book/search` or use the search bar on the book homepage.
- **Backward compatibility** — `/book` changes purpose (**BREAKING** for bookmarks/links pointing to book search). Consider a redirect or ensure the book homepage has a visible search entry point so users aren't disoriented.
- **No backend changes** — This is purely a frontend routing and component restructure.
