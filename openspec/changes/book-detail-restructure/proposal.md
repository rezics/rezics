## Why

The current book detail page has several structural problems: language switching is embedded in the hero section instead of being a page-wide control, author information uses the legacy `user` model instead of the entity model (which supports translations), tab content grouping is suboptimal (the info tab is overloaded while review and shelf are awkwardly combined with remarks), and the sidebar is static across all tabs. This restructure reorganizes the page into a cleaner information architecture with contextual, responsive layout.

## What Changes

### Tab Reorganization (4 tabs)

The current tabs (Info / Content / Reviews / Discussion) are replaced with:

1. **Overview** — Basic info + three lightweight interactions: description, quote excerpts preview, inline rating widget, and remark (short review) preview. This is the "learn about this book" tab.
2. **Review & Shelf** — The platform's signature features showcased together. Shows a preview of full reviews (3-5 items) with a link to the dedicated review page (`/review/book/$bookId`), and a preview of shelves containing this book (3-5 items) with a link to the dedicated shelf page (`/shelf/book/$bookId`). Reviews and shelves share a conceptual link through the special readlist mode that allows collecting reviews. This tab does NOT contain any "add to shelf" action — that belongs at the unit level (hero action bar, individual review cards, quote cards, post cards).
3. **Content** — Chapter index with a release selector. The selector lists all releases under the work, with the translation-designated official release for the current language pinned to the top. Other same-language releases follow, then other languages' releases. Language switching auto-selects the new language's official release, but the user can manually override.
4. **Community** — Discussion threads (unchanged from current Discussion tab).

### Language Switching — Wiki-style Dropdown

Remove `TranslationTabs` from the hero section. Add a language dropdown fixed to the right end of the tab bar, visually similar to Wikipedia's language selector. The tab bar scrolls horizontally on small screens, but the language dropdown remains pinned/fixed on the right.

Language selection is **per-book** (ephemeral, not persisted), but the initial language is resolved from the user's **session-wide language preference priority list** stored in `UserSettings.preferredLanguages`. Resolution: iterate the user's ordered preference list and pick the first language available in the book's translations. If no match, fall back to the existing translation resolution chain (unit default → `en` → first available).

Switching language affects the entire page: hero title/description, author entity name/bio, and the default release selection in the Content tab.

### Author Attribution — Entity Model

Replace the current `bookInfo.user`-based author display with entity-based attribution. The entity model (from `entity-attribution-unification`) supports translations, so author name and bio follow the selected language. The hero section and any author info display should resolve attribution through `bookInfo.attributions` → entity → entity translations.

### Release Selector in Content Tab

The Content tab gains a release selector dropdown above the chapter tree. Data flow:

- All releases are fetched from the work's release list (already available via `WorkReleaseNav` data).
- The book's `translations[]` array provides the official release `unitId` for each language.
- Releases are sorted: current language first, then official (translation-designated) releases pinned above non-official ones within each language group.
- Default selection = `translations.find(tr => tr.language === selectedLang).unitId`.
- Selecting a release loads that release's chapter index via `bookQueries.chapterIndex(releaseUnitId)`.

### Contextual Sidebar

Replace the current static `BookDetailSidebar` (which shows the same metadata panel on every tab) with a **per-tab contextual sidebar**. Each tab defines which sidebar sections to display.

On **desktop** (lg+), sidebar sections render in the right column (9+3 grid). On **mobile/tablet**, sidebar sections are **redistributed inline** into semantically relevant positions within the tab content — not collapsed to the bottom, but interspersed. Each sidebar section is an independent component; tab pages control placement via a responsive slot pattern.

### Settings — Ordered Language Preference

The existing `SettingsPreferencesSection` treats `preferredLanguages` as an unordered set (toggle chips). This changes to an **ordered priority list** with drag-to-reorder, reflecting the user's language preference priority. The `UserSettings.preferredLanguages` contract schema (`Array<string>`) does not need to change — only the frontend treatment (Set → ordered Array with reorder UI).

## Capabilities

### New Capabilities

- `book-detail-tab-layout`: Tab reorganization (Overview / Review & Shelf / Content / Community), tab bar with scrollable tabs + fixed language dropdown, contextual per-tab sidebar with responsive mobile redistribution
- `book-detail-language-switcher`: Wiki-style language dropdown replacing TranslationTabs, per-book ephemeral selection with preference-based initial resolution, page-wide language propagation
- `book-detail-release-selector`: Release selector in Content tab, official release pinning, language-linked default selection, chapter index loading by release unitId

### Modified Capabilities

- `settings-preferences`: Language preference UI changes from unordered toggle chips to ordered drag-to-reorder list
- `unified-attribution`: Author display in book detail hero and info sections must resolve through entity model with translation support (was using `bookInfo.user`)

## Impact

### Affected Packages

- `@rezics/app` — Primary impact. Book-library feature restructure: new tab pages (OverviewPage, ReviewShelfPage), modified pages (ContentPage, CommunityPage), new components (LanguageDropdown, ReleaseSelector, contextual sidebar sections), removed components (TranslationTabs usage in hero), modified layout (BookDetailShell tab bar + sidebar slot system), modified hero (BookHeroSection author entity resolution). Settings feature: SettingsPreferencesSection reorder UI.
- `@rezics/contract` — No schema changes required. `UserSettings.preferredLanguages` is already `Array<string>`. `BookDTO.translations` and `BookDTO.attributions` already carry the needed data.
- `@rezics/api` — May need new/adjusted query hooks if release list or entity translation data is not currently fetched in the book detail query. Verify existing `bookQueries.detail()` response includes attribution entity translations.

### Backward Compatibility

- No API contract changes. All changes are frontend-only (page layout, component restructure, UI behavior).
- Route paths remain unchanged (`/book/$bookId/info`, `/book/$bookId/content`, `/book/$bookId/review`, `/book/$bookId/discussion`). Internal route-to-tab mapping changes but URLs are stable.
- `UserSettings.preferredLanguages` retains its schema — the ordered-list semantics are additive (an unordered set is a degenerate ordered list).
