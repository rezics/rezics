## 1. Create BookHomePage component

- [ ] 1.1 Create `package/app/src/book-library/page/BookHomePage.tsx` — a new page component that composes book-specific sections: BookHomeHeroSection (with search bar → /book/search), QuickAccessLinks, NewBookSection (12 items), TrendingBookSection, TrendingQuoteSection
- [ ] 1.2 Export `BookHomePage` from `package/app/src/book-library/index.ts`

## 2. Create BookHomeHeroSection

- [ ] 2.1 Create `package/app/src/book-library/section/BookHomeHeroSection.tsx` — book library hero with branding and a search bar that navigates to `/book/search` on submit. Use `useTranslation()` for all strings
- [ ] 2.2 Verify the search bar routes to `/book/search` with query parameter on submit

## 3. Restructure routes

- [ ] 3.1 Update `package/app/src/routes/_mainLayout/book/index.tsx` to render `BookHomePage` instead of `BookLibPage`
- [ ] 3.2 Update `package/app/src/routes/_mainLayout/book/search.tsx` to render `BookLibPage` (ensure it works standalone at `/book/search`)
- [ ] 3.3 Verify TanStack Router route tree regenerates correctly (`routeTree.gen.ts`)

## 4. Slim down global homepage

- [ ] 4.1 Remove book-specific sections from `package/app/src/home/page/Home.tsx`: TrendingBookSection, TrendingQuoteSection, full-size NewBookSection, QuickAccessLinks
- [ ] 4.2 Add a compact "Latest Works" preview section to the global homepage (3-5 items) with "See all" link to `/book`
- [ ] 4.3 Ensure review and realm sections (TrendingReviewsSection, ActiveRealmsSection) remain prominent on global homepage

## 5. Rebrand hero and footer

- [ ] 5.1 Update hero section in `Home.tsx` — change kicker text from "Library Book" (`page.home.hero.kicker`) to "REZICS" in all locale files
- [ ] 5.2 Update `package/app/src/core/component/footer/MainLayoutFooter.tsx` — change "Library.Book" brand text to "REZICS"
- [ ] 5.3 Update footer brand description in locale files to reflect multi-library platform identity (not just books)
- [ ] 5.4 Grep codebase for remaining "Library Book" and "Library.Book" references and update to "REZICS"

## 6. Navigation updates

- [ ] 6.1 Review `MainNavigation.tsx` to ensure `/book` nav item label reflects it's now a library homepage (not search)
- [ ] 6.2 Update "More →" links in homepage sections to point to correct routes (e.g., books "See all" → `/book`, not `/book/search`)

## 7. Validation

- [ ] 7.1 Run `bun run build` in `package/app` to verify compilation
- [ ] 7.2 Start dev server and verify `/` renders the slimmed-down REZICS homepage with cross-platform sections
- [ ] 7.3 Verify `/book` renders the curated book library homepage with book-specific sections
- [ ] 7.4 Verify `/book/search` renders the full search interface with filters and pagination
- [ ] 7.5 Verify the search bar on `/book` navigates to `/book/search` with the entered query
- [ ] 7.6 Verify footer shows "REZICS" branding on all pages
- [ ] 7.7 Verify hero shows "REZICS" branding on homepage
- [ ] 7.8 Switch UI language and verify all new/moved sections render translated strings
