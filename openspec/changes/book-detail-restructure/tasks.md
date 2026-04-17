## 1. Language State Infrastructure

- [x] 1.1 Create `bookLanguageAtom(bookId)` in `package/app/src/book-library/state/bookDetailAtoms.ts` — a Jotai atom family storing the selected language per book, initialized to `null` (resolved on first render)
- [x] 1.2 Create `useBookLanguage(bookId)` hook in `package/app/src/book-library/hooks/` that resolves the initial language from `userSettings.preferredLanguages` matched against `book.translations[].language`, falling back through the existing resolution chain. Returns `[selectedLang, setSelectedLang]`
- [x] 1.3 Create `getEntityTranslation(attributions, role, language)` helper in `package/app/src/shared/util/translation-helpers.ts` that resolves an entity's translated name/bio for a given language from the attribution's entity translations

## 2. Backend Verification — Entity Translations in Book Detail

- [x] 2.1 Verify that `bookQueries.detail(bookId)` response includes `attributions[].entity.translations[]`. If missing, add `entity: { include: { translations: true } }` to the Prisma query in `package/server/src/book/` (or equivalent content service). This is a query expansion, not a contract change
- [x] 2.2 Verify `BookDTO` in `@rezics/contract` includes entity translations in the attribution type. If the type needs widening, update accordingly

## 3. Tab Bar Restructure — BookDetailShell

- [x] 3.1 Refactor `BookDetailSection.tsx` (`BookDetailShell`): change `TAB_ROUTES` to `["info", "review", "content", "discussion"]` with labels "Overview", "Review & Shelf", "Content", "Community". Set MUI Tabs to `variant="scrollable"` and `scrollButtons="auto"`
- [x] 3.2 Add the language dropdown component to `BookDetailShell` — a `Select`/`Menu` at the right end of the tab bar row using flex layout (`Tabs` gets `flex: 1`, dropdown gets `flex-shrink: 0`). Dropdown reads/writes from `useBookLanguage(bookId)`
- [x] 3.3 Convert `BookDetailShell` to accept a `sidebar` prop (ReactNode). Render sidebar in a `Grid size={{ lg: 3 }}` column on desktop. On mobile, do not render the sidebar column (tab pages handle inline placement)

## 4. Hero Section Updates

- [x] 4.1 Remove `TranslationTabs` import and rendering from `BookHeroSection.tsx`. Remove local `selectedLang` state — read from `useBookLanguage(bookId)` instead
- [x] 4.2 Replace `bookInfo.user`-based author display with entity attribution resolution: use `getEntityTranslation(bookInfo.attributions, 'author', selectedLang)` for author name. Same for publisher and producer
- [x] 4.3 Verify hero re-renders correctly when language changes (title, author, publisher all update)

## 5. Overview Tab (formerly Info)

- [x] 5.1 Refactor `BookBasicInfoPage.tsx` into the Overview tab: render Description (language-aware), QuoteExcerptPreview, Rating widget (inline scoring), RemarkPreview (with quick-submit form)
- [x] 5.2 Remove `AuthorInfo` component from the Overview tab (author info is now in the hero via entity attribution)
- [x] 5.3 Remove `TagWrapper` from Overview tab (tags are displayed in the hero)
- [x] 5.4 Create Overview sidebar sections: MetadataPanel (ISBN, text length, page count, format) and OtherEditions (WorkReleaseNav). Pass as `sidebar` prop to `BookDetailShell`
- [x] 5.5 Add mobile inline placement: render MetadataPanel after Description and OtherEditions at the end, visible only below lg breakpoint (use UnoCSS `lg:hidden` class)

## 6. Review & Shelf Tab

- [x] 6.1 Refactor `BookReviewPage.tsx` into the Review & Shelf tab: remove the sub-tabs (Remarks/Reviews), remove `RemarkInlineForm` and `RemarkList` (remarks moved to Overview). Keep ReviewList as a preview (3-5 items) with "view all" link to `/review/book/$bookId` and "Write a Review" CTA
- [x] 6.2 Add `ShelfByBookPreview` section below reviews showing 3-5 shelf cards with "view all" link to `/shelf/book/$bookId`
- [x] 6.3 Create Review & Shelf sidebar sections: ScoreOverview (rating distribution chart) and optionally a related shelves recommendation. Pass as `sidebar` prop
- [x] 6.4 Add mobile inline placement: ScoreOverview above the review list (below lg breakpoint)

## 7. Content Tab — Release Selector

- [x] 7.1 Create `ReleaseSelector` component in `package/app/src/book-library/component/` — a dropdown that lists all releases under the work, sorted by: (1) current language first, (2) official releases (translation-designated) pinned within each language group. Display release title, language tag, and "(official)" badge for translation-designated releases
- [x] 7.2 Create `useReleaseSelection(bookInfo, selectedLang)` hook that manages release state: initializes to the official release for the current language (`translations.find(tr => tr.language === selectedLang).unitId`), auto-switches on language change, allows manual override
- [x] 7.3 Refactor `BookContentPage.tsx`: add `ReleaseSelector` above `ChapterList`, pass `selectedReleaseUnitId` to `ChapterList` so it fetches `bookQueries.chapterIndex(selectedReleaseUnitId)` instead of the current book's ID
- [x] 7.4 Create Content sidebar sections (e.g., reading progress if available, book stats). Pass as `sidebar` prop. Add mobile inline placement

## 8. Community Tab

- [x] 8.1 Rename `BookDiscussionPage` references in exports to align with "Community" naming (internal only — route path stays `/discussion`)
- [x] 8.2 Create Community sidebar sections (e.g., pinned/hot threads, active contributors). Pass as `sidebar` prop. Add mobile inline placement

## 9. Settings — Ordered Language Preference

- [x] 9.1 Refactor `SettingsPreferencesSection.tsx` language UI from unordered chip toggles to an ordered list with drag-to-reorder (use `@dnd-kit` from `@rezics/ui`). Each item shows the language label with a drag handle. Add and remove buttons preserved
- [x] 9.2 Ensure `updateSettings.mutate({ preferredLanguages: [...orderedList] })` sends the array in user-defined order

## 10. Cleanup and Removal

- [x] 10.1 Remove `TranslationTabs` usage from the book detail feature (it may still be used elsewhere — only remove the book detail import)
- [x] 10.2 Remove or repurpose `BookDetailSidebar.tsx` — its content is now distributed across per-tab sidebar sections
- [x] 10.3 Update `package/app/src/book-library/index.ts` exports: rename/add page exports to reflect new tab names (OverviewPage, ReviewShelfPage, etc.)

## 11. Validation

- [x] 11.1 Run `bun run tsc --noEmit` in `package/app` to verify no type errors
- [x] 11.2 Run `bun run tsc --noEmit` in `package/contract` if any contract types were modified
- [ ] 11.3 Run `bun run app:dev` and manually verify: all four tabs render, language dropdown works, release selector loads correct chapter index, sidebar appears on desktop and redistributes on mobile, hero displays entity-based author info
- [x] 11.4 Run `bun run knip` at root to check for unused exports after the restructure
