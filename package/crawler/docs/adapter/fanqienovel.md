## Adapter: Fanqienovel (`fanqienovel.com`)

- File: `src/lib/adapters/fanqienovel.ts`
- Exports: `platform`, `domain`, `strategy`, `test`

### Navigation and readiness

1. `page.goto(url)`
2. Cover image selector waits for class: `.book-cover-img.loaded`.

### Field extraction

- `cover`:
  - `cover_src = await page.locator('.book-cover-img.loaded').getAttribute('src')`
  - Base64 from `responses.find(r => r.url() === cover_src).body()`.
- `title`:
  - `.info-name` textContent.
- `authors`:
  - `.author-name-text` textContent → `[author]`.
- `description`:
  - `.page-abstract-content` textContent.
- `tags`:
  - `.info-label` → iterate `children` as `HTMLElement` and collect
    `.innerText`.
- `units` (volumes/chapters):
  - For each `.volume` element, evaluate in-page:
    - Reduce over `volumeElement.parentElement!.children`:
      - When `cur.classList.contains('chapter')`, iterate its children and push
        `{ title: chapter.innerText }` to `acc.children`.
      - Otherwise ignore.
    - Seed accumulator `{ title: volumeElement.innerText, children: [] }`.
- `completed`:
  - `tags.some(tag => tag.includes('完结'))`.
- `length`:
  - `.info-count-word .detail` innerText is a number of 万 (ten-thousands).
    Multiply by `1_0000`.
- `last_update`:
  - `.info-last-time` first text → `new Date(...).toISOString()`.
- `release`, `rating`: set to `null`.

### Test URL

- `https://fanqienovel.com/page/7143038691944959011`

### Notes

- Chapter list is not strictly nested under each volume; the code navigates
  sibling structures to gather chapters belonging to the preceding `.volume`.
- Cover URL is absolute; equality match on `responses` is sufficient.
