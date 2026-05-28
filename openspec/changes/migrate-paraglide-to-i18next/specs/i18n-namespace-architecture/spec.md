## ADDED Requirements

### Requirement: Translation file layout uses directory-per-locale

Translation source files SHALL live under `public/locales/{lng}/{ns}.json`,
one JSON file per namespace per locale. The directory under `public/locales/`
SHALL be the locale code; the file name SHALL be the namespace plus the
`.json` extension. No alternative layouts (e.g. `{ns}.{lng}.json` or
per-package locale roots) SHALL be used for the shared app/admin catalog.

#### Scenario: Translator opens the Japanese folder

- **WHEN** a translator opens `public/locales/ja/`
- **THEN** they SHALL see one file per namespace (e.g. `common.json`,
  `shell.json`, `book.json`)
- **AND** every file in that folder SHALL contain only Japanese
  translations

#### Scenario: A new locale is added

- **WHEN** a new canonical locale code is registered in
  `@rezics/contract`
- **THEN** a new folder `public/locales/<lng>/` SHALL be created
- **AND** every existing namespace JSON SHALL have a corresponding file
  in the new locale folder

### Requirement: Canonical namespace map consolidates underscore prefixes

The frontend message catalog SHALL be partitioned into the following
namespaces. Each underscore prefix from the legacy flat catalog SHALL
map to exactly one of these namespaces. New keys SHALL use the namespace
prefix that matches the closest existing prefix in this table.

| Namespace | Underscore prefixes consolidated | Loading |
|-----------|----------------------------------|---------|
| `common` | `common`, `accessibility`, and semantically-merged cross-domain words | bootstrap |
| `shell` | `layout`, `navigation`, `home`, `theme`, `app`, `language`, `media` | bootstrap |
| `auth` | `auth` | bootstrap |
| `book` | `book`, `chapter`, `chapters`, `pages`, `release`, `units`, `title` | route-lazy |
| `page` | `page`, `remark` | route-lazy |
| `entity` | `entity`, `work`, `attribution`, `collection`, `realm`, `shelf`, `pinboard` | route-lazy |
| `community` | `feedback`, `review`, `progress`, `post`, `comment`, `reactions`, `tag`, `excerpt`, `rating`, `score`, `discussion`, `engagement` | route-lazy |
| `search` | `search`, `history`, `zone` | route-lazy |
| `settings` | `settings`, `profile`, `notifications`, `notify`, `ai`, `edit`, `user`, `license` | route-lazy |
| `editor` | `editor`, `placeholders`, `authority` | route-lazy |
| `admin` | `admin` | route-lazy, admin-only |
| `ui` | UI package-owned messages | bundled with `@rezics/ui` |

#### Scenario: New key follows the namespace map

- **WHEN** a developer adds a new translation key for a feature whose
  closest underscore prefix is `book_*`
- **THEN** the key SHALL live in `public/locales/{lng}/book.json`
- **AND** the call site SHALL reference it as `t('book:<key>')`

#### Scenario: Cross-domain word lives in `common`

- **WHEN** a developer adds a translation for a generic UI verb (e.g.
  "Save", "Cancel") used in more than one domain
- **THEN** the key SHALL live in `common.json`
- **AND** the call site SHALL reference it as `t('common:<key>')`

#### Scenario: Admin-only key is isolated

- **WHEN** a developer adds a translation for an admin-only screen
- **THEN** the key SHALL live in `admin.json`
- **AND** no non-admin package SHALL reference any `admin:<key>`

### Requirement: Bootstrap namespaces load at app initialization

The i18next runtime SHALL fetch the bootstrap namespace set
(`common`, `shell`, `auth`) in parallel during `i18next.init` for the
detected active locale. Application root rendering SHALL wait on the
bootstrap fetch before mounting localized React trees.

#### Scenario: Cold first paint

- **WHEN** a user loads the app with no cached translation data
- **THEN** the i18next runtime SHALL issue three parallel `GET`
  requests for `/locales/<lng>/common.json`,
  `/locales/<lng>/shell.json`, and `/locales/<lng>/auth.json`
- **AND** the application root SHALL render a neutral splash until
  all three responses arrive
- **AND** no localized React component SHALL render with raw key
  text

#### Scenario: Bootstrap fetch failure

- **WHEN** any bootstrap namespace fetch fails (network error or
  HTTP 4xx/5xx)
- **THEN** the runtime SHALL retry with exponential backoff up to
  the i18next backend default
- **AND** persistent failure SHALL surface a user-visible error
  state instead of rendering raw keys

### Requirement: Non-bootstrap namespaces load on demand

Namespaces outside the bootstrap set SHALL be fetched lazily when a
React tree first calls `useTranslation('<ns>')` for them, or when a
route-level prefetch invokes `i18next.loadNamespaces(['<ns>'])`.

#### Scenario: User navigates to the book route

- **WHEN** a user navigates to a route whose components call
  `useTranslation('book')`
- **THEN** the runtime SHALL fetch `/locales/<lng>/book.json` on
  first render
- **AND** subsequent renders SHALL reuse the cached namespace
  without refetching

#### Scenario: Route-level prefetch

- **WHEN** the application calls `i18next.loadNamespaces(['book'])`
  during link hover or route data prefetch
- **THEN** the runtime SHALL begin fetching the namespace in the
  background
- **AND** the eventual render via `useTranslation('book')` SHALL
  not re-issue the fetch

### Requirement: Locale switching swaps every loaded namespace

Calling `i18next.changeLanguage(locale)` SHALL fetch the new locale's
copy of every currently-loaded namespace in parallel and SHALL persist
the selection to `localStorage` under the key `rezics-locale`.
Locale switching SHALL NOT require a page reload, route remount, or
any consumer-side effect beyond awaiting the `changeLanguage` promise.

#### Scenario: User switches from `en` to `ja`

- **WHEN** the user selects Japanese while the runtime has
  `common`, `shell`, `auth`, and `book` loaded for `en`
- **THEN** the runtime SHALL fetch all four namespaces' Japanese
  versions in parallel
- **AND** React subscribers SHALL re-render once with the new
  Japanese strings
- **AND** `localStorage.getItem('rezics-locale')` SHALL equal
  `'ja'` after the promise resolves

#### Scenario: Switched-to locale lacks a namespace key

- **WHEN** a key exists in the previously-active locale's namespace
  JSON but is missing in the newly-selected locale's namespace JSON
- **THEN** `t('<ns>:<key>')` SHALL resolve through the i18next
  fallback chain to the `en` value
- **AND** the `check:i18n` script (run pre-commit and in CI) SHALL
  catch the gap before such a state can be merged

### Requirement: Dedup distinguishes semantic from accidental collisions

Translation values that appear identically across multiple keys SHALL
be classified as either `semantic` (same meaning, safe to merge into a
single canonical key under `common`) or `accidental` (same English
string by coincidence, must remain distinct so other-locale
translations may diverge). Only `semantic` groups SHALL be merged.

#### Scenario: Cross-domain "Tags" is merged

- **WHEN** the dedup analysis finds nine distinct keys whose `en`
  value is the literal string `"Tags"` used as the same UI label
  across `common_*`, `book_*`, `shelf_*`, and `realm_*`
- **THEN** the merge SHALL produce a single canonical key under
  `common:tags`
- **AND** every original call site SHALL be rewritten to reference
  `common:tags`
- **AND** the old keys SHALL be removed from every locale JSON

#### Scenario: Accidental "Title" collision is preserved

- **WHEN** the dedup analysis finds that `book_title`, `page_title`,
  and `realm_title` all render `"Title"` in `en` but represent
  distinct domain concepts
- **THEN** the keys SHALL remain separate under their respective
  namespaces
- **AND** no merge SHALL occur
- **AND** the dedup report SHALL record the classification with
  reviewer attribution
