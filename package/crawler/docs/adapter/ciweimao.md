## Adapter: Ciweimao (`www.ciweimao.com`)

- File: `src/lib/adapters/ciweimao.ts`
- Exports: `platform`, `domain`, `strategy`, `discover`, `test`

### Navigation and readiness

1. `page.goto(url)`; if `res.status() !== 200`, retry reload with 3s backoff
   until 200.
2. Click the “read all” button to expand content:
   - `const show = page.locator('a.btn-read-all')`
   - `await show.last().click()` then `await expect(show).toHaveCount(0)` to
     ensure expanded state.

### Field extraction

- `cover`:
  - `cover_src = await page.locator('.cover img').first().getAttribute('src')`
  - Read bytes from `responses.find(r => r.url() === cover_src).body()` →
    base64.
- `title`:
  - From `.title` element, filter `childNodes` to `Text` and take textContent;
    trim.
- `authors`:
  - `.title span a` → innerText → single-element array.
- `tags`:
  - `.label-box` → iterate `children` where element is `HTMLSpanElement` →
    `.innerText.trim()`.
- `description`:
  - `.book-desc` innerText; trim.
- `units` (volumes/chapters):
  - Locate the first `.book-chapter-box` and inside it, each nested
    `.book-chapter-box` is a volume.
  - For each `volume`:
    - `title`: take the first `Text` node content of the `volume` element.
    - `children`: within `.book-chapter-list`, map each `li` to
      `{ title: innerText.trim() }`.
- `completed`:
  - `Boolean((await page.locator('p.update-state').first().innerText())?.includes('完结'))`.
- `length`:
  - From `.book-property span:has-text("完成字数") i` → parseInt of innerText.
- `last_update`:
  - From `p.update-time` innerText, extract bracketed timestamp with
    `/\[(.*)\]/` and convert to ISO.
- `release`, `rating`: set to `null` (unknown on this page).

### Discovery

- Start at `https://www.ciweimao.com/book_list`.
- Loop:
  - Collect all `href`s under `table.book-list-table a` and filter those
    starting with `https://www.ciweimao.com/book`.
  - Yield each as a `URL`.
  - Click next: `ul.pagination li:has-text('>>')` (last);
    `await Promise.all([page.waitForURL(/.*/), next.click()])`.
- Errors are caught, logged, and discovery ends.

### Test URL

- `https://www.ciweimao.com/book/100409881`

### Notes

- Uses explicit `expect(...).toHaveCount(0)` to ensure expansion and avoid
  racing reads.
- Uses strict equality on `cover_src` vs `response.url()` since the DOM provides
  absolute URLs.
