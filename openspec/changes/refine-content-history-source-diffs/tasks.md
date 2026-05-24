## 1. Compare Model Classification

- [ ] 1.1 Add focused tests in `package/app/src/book-library/models/historyCompare.test.ts` for `translations.en.description.main.source` rendering as a markdown/text change while preserving the full path.
- [ ] 1.2 Add model tests for multiple source leaves under one rich object, such as `description.main.source` and `description.slots.cast.title.source`, proving they remain separate changes.
- [ ] 1.3 Add a source-leaf classifier in `package/app/src/book-library/models/historyCompare.ts` that recognizes legacy long-text fields and nested rich content `source` leaves only when compared values are strings.
- [ ] 1.4 Update `compareRevisionPathSnapshots` to use the source-leaf classifier before scalar/raw fallback, without changing collection handling.
- [ ] 1.5 Keep short string paths such as title, subtitle, slug, and enum-like fields on scalar before/after rendering unless explicitly classified as source text.

## 2. Compare Surface Rendering

- [ ] 2.1 Verify `BookRevisionComparePage` keeps full changed paths for nav keys, anchors, and headings when rendering nested source leaves.
- [ ] 2.2 Ensure unified and split mode switches render the same source diff content for nested source leaves.
- [ ] 2.3 If path labels become ambiguous, add readable segment labeling that preserves leaf detail such as `main.source` and `slots.cast.title.source`.
- [ ] 2.4 Confirm product-safe fallback still hides raw object values for unrecognized object changes when `allowRaw` is false.

## 3. Regression Coverage

- [ ] 3.1 Add regression coverage proving `description.main.source` does not render as a plain scalar before/after change.
- [ ] 3.2 Add regression coverage proving layout mode does not change the set of changed paths rendered by the compare model/page.
- [ ] 3.3 Add regression coverage for a non-source string path proving it remains scalar.
- [ ] 3.4 Add regression coverage for unknown object changes proving raw JSON is not exposed in public compare output.

## 4. Verification

- [ ] 4.1 Run targeted app history compare tests.
- [ ] 4.2 Run `bun run check:convention`.
- [ ] 4.3 Manually verify a Book description ContentDoc source edit shows the full nested path and a text diff in unified mode.
- [ ] 4.4 Manually verify the same edit remains a text diff in split mode.
