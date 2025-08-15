## Adapter: Qidian (`www.qidian.com`)

- File: `src/lib/adapters/qidian.ts`
- Exports: `platform`, `domain`, `strategy`, `discover`, `test`

### Navigation and readiness

1. `page.goto(url)`
2. Extract once key selectors are present.

### Field extraction

- `cover`:
  - From `#bookImg img` first `src`.
  - Match network by suffix: `responses.find(r => r.url().endsWith(cover_src))`
    → base64 body.
- `title`:
  - `#bookName` innerText.
- `authors`:
  - `.author` innerText, split by `:` and take last segment.
- `tags`:
  - `.all-label` first → `a` → `allInnerTexts()`.
- `description`:
  - `#book-intro-detail` first innerText.
- `units` (volumes/chapters):
  - For each `.catalog-volume`:
    - `title`: from `.volume-name` first `Text` child’s `textContent.trim()`.
    - `children`: `.chapter-name` → `allInnerTexts()` mapped to `{ title }`.
- `length`:
  - From `.count em` first innerText; match `/ (\d+)万 /`, parse, and multiply
    by `10,000`.
- `release`: `null`.
- `last_update`:
  - `.update-time` innerText; remove leading `更新时间:` then
    `new Date(...).toISOString()`.
- `completed`:
  - From `.book-attribute` `allInnerTexts()`, check any includes `"完本"`.
- `rating`: `null`.

### Discovery

- `make_discover(async function* (page, keyword: string) { ... })`
- Workflow:
  - `goto https://www.qidian.com/so/${keyword}.html`
  - `get_links`: for each `.book-img-box`, take `a` attribute `src` (note:
    Qidian uses `src` attribute for book links within search results).
  - Yield each as `URL` (guarded by try/catch if attribute is
    missing/malformed).
  - Pagination: click `.lbf-pagination-next` last; in parallel, wait until the
    link list changes (simple polling of `get_links` comparing JSON strings) to
    avoid tight-click loops.

### Test URL

- `https://www.qidian.com/book/1032982789`

### Notes

- Matching cover by `endsWith(cover_src)` handles relative `src` values served
  via CDN paths in network events.
- The discovery polling loop is a defensive wait ensuring fresh results before
  moving to the next page.
