# Cosmos Fixture Inventory

**Phase 8 / T8.1 artifact.** Migration list for T8.2 (Cosmos → Storybook).
**Date:** 2026-05-01.

## Summary

| Package          | Fixtures | Suffix         | Config artifacts                                    |
| ---------------- | -------: | -------------- | --------------------------------------------------- |
| `@rezics/ui`     |        8 | `.test.tsx` ⚠ | `cosmos.config.json`, `src/cosmos.decorator.tsx`    |
| `@rezics/app`    |       19 | `.fixture.tsx` | `cosmos.config.json`, `src/cosmos.decorator.tsx`    |
| `@rezics/editor` |        9 | `.fixture.tsx` | `cosmos.config.json`, `vite.cosmos.config.ts`       |
| `@rezics/folio`  |        5 | `.fixture.tsx` | `cosmos.config.json`, `vite.cosmos.config.ts`       |
| `@rezics/admin`  |        0 | —              | none — only `react-cosmos` devDeps + npm scripts    |
| **Total**        |   **41** |                |                                                     |

`@rezics/admin` has no fixtures and no Cosmos config; T8.3 just removes the unused devDeps + scripts.

---

## ⚠ Suffix conflict — `@rezics/ui` only

`package/ui/cosmos.config.json` sets `"fixtureFileSuffix": "test"` (probably to avoid colliding with the `.fixture.tsx` suffix used elsewhere). But `bun:test` *also* discovers `*.test.{ts,tsx}` by default. The result is that `.test.tsx` in `@rezics/ui` is a **shared namespace** holding two unrelated kinds of file:

| Kind          | Count | Example                                              |
| ------------- | ----: | ---------------------------------------------------- |
| Cosmos fixture |    8 | `src/primitive/carousel/ArrowButton.test.tsx`        |
| `bun:test` test |    4 | `src/composite/feedback/EmptyState.test.tsx`         |

When migrating, **rename the 8 Cosmos fixtures** to a Storybook-conventional `.stories.tsx` so the 4 real `bun:test` files keep ownership of `.test.tsx`. Without this rename, `bun test` and Storybook globs continue to overlap and the conflict outlives Cosmos.

---

## `@rezics/ui` — 8 fixtures

All to be renamed `*.test.tsx` → `*.stories.tsx` and converted from `useFixtureInput` / default-export-component to CSF (`Meta` + `StoryObj`).

| File (relative to `package/ui/src/`)                              | Notes                                  |
| ----------------------------------------------------------------- | -------------------------------------- |
| `primitive/carousel/ArrowButton.test.tsx`                         | uses `useFixtureInput` for icon prop   |
| `primitive/decorative/AccentBar.test.tsx`                         | cosmos fixture                         |
| `primitive/button/colorful/GreenButton.test.tsx`                  | bare default-export fixture            |
| `composite/layouts/CustomSidebar.test.tsx`                        | cosmos fixture                         |
| `composite/button/EditButtonFloatRight.test.tsx`                  | cosmos fixture                         |
| `composite/navigation/ArrowForwardIcon.test.tsx`                  | cosmos fixture                         |
| `composite/pagination/Pagination.test.tsx`                        | cosmos fixture                         |
| `composite/typography/AccentBarWithText.test.tsx`                 | cosmos fixture                         |

**Leave alone (real `bun:test` suites — must keep `.test.tsx`):**
- `primitive/typography/collapsible/Collapsible.test.tsx`
- `composite/feedback/EmptyState.test.tsx`
- `composite/auth/TrustedEmailField.test.tsx`
- `composite/cookie-consent/CookieConsentBanner.test.tsx`

**Decorator:** `package/ui/src/cosmos.decorator.tsx` wraps fixtures in `StyledEngineProvider` + `ThemeProvider` + a mock TanStack router. The Storybook preview at `package/ui/.storybook/preview.tsx` already provides theme + light/dark toolbar, so the cosmos decorator is **redundant on migration** — drop it. Mock router is currently only needed for fixtures that use TanStack `Link`; check each renamed story and add a Storybook decorator using the host config's router mock if needed.

---

## `@rezics/app` — 19 fixtures

| Domain         | File (relative to `package/app/src/`)                                |
| -------------- | -------------------------------------------------------------------- |
| book-library   | `book-library/components/ExcerptPreview.fixture.tsx`                 |
| book-library   | `book-library/components/Chapter/ChapterList.fixture.tsx`            |
| book-library   | `book-library/components/BookDescription/BookDescriptionTest.fixture.tsx` |
| book-library   | `book-library/components/BookList/CardBookList.fixture.tsx`          |
| engagement     | `engagement/components/ReactionBar.fixture.tsx`                      |
| engagement     | `engagement/components/VoteGroup.fixture.tsx`                        |
| engagement     | `engagement/components/ReplyAction.fixture.tsx`                      |
| engagement     | `engagement/components/ShareAction.fixture.tsx`                      |
| engagement     | `engagement/components/ShelfAction.fixture.tsx`                      |
| engagement     | `engagement/components/OverflowMenu.fixture.tsx`                     |
| home           | `home/components/HomeCarousel.fixture.tsx`                           |
| post           | `post/components/parts/ThreadingRail.fixture.tsx`                    |
| post           | `post/sections/PostTreeSection.fixture.tsx`                          |
| post           | `post/forms/ReplyComposer.fixture.tsx`                               |
| shelf          | `shelf/sections/ShelfDiscussionSection.fixture.tsx`                  |
| tag            | `tag/components/TagTest.fixture.tsx`                                 |
| tag            | `tag/components/Edit/TagListEdit.fixture.tsx`                        |
| tag            | `tag/components/Edit/TagEdit.fixture.tsx`                            |
| user           | `user/components/Small.fixture.tsx`                                  |

**Decorator:** `package/app/src/cosmos.decorator.tsx` mounts QueryClient + theme + router. Most of this is already in `package/app/.storybook/preview.tsx`; QueryClient may need to be added there if the renamed stories rely on TanStack Query.

---

## `@rezics/editor` — 9 fixtures

| Subsystem | File (relative to `package/editor/src/`)            |
| --------- | --------------------------------------------------- |
| editor    | `editor/EditorOptions.fixture.tsx`                  |
| markdown  | `editor/markdown/MarkdownEditor.fixture.tsx`        |
| markdown  | `editor/markdown/MarkdownPlugins.fixture.tsx`       |
| markdown  | `editor/markdown/MarkdownPreview.fixture.tsx`       |
| markdown  | `editor/markdown/MarkdownToolbar.fixture.tsx`       |
| json      | `editor/json/JsonEditor.fixture.tsx`                |
| json      | `editor/json/JsonToolbar.fixture.tsx`               |
| code      | `editor/code/CodeEditor.fixture.tsx`                |
| theme     | `editor/theme/EditorTheme.fixture.tsx`              |

**Vite override:** `package/editor/vite.cosmos.config.ts` exists because the main editor `vite.config.ts` carries the broken `tanstackRouter` plugin. The Storybook spike (`package/editor/.storybook/vite.config.ts`) already side-steps this with an isolated config — once Cosmos is removed, `vite.cosmos.config.ts` deletes too.

---

## `@rezics/folio` — 5 fixtures

| File (relative to `package/folio/src/`)            | Notes               |
| -------------------------------------------------- | ------------------- |
| `FolioInteractive.fixture.tsx`                     | top-level container |
| `FolioEdgeStates.fixture.tsx`                      | edge cases          |
| `FolioThemes.fixture.tsx`                          | mode coverage       |
| `plugins/epub/EpubFolio.fixture.tsx`               | epub plugin         |
| `plugins/txt/TxtFolio.fixture.tsx`                 | txt plugin          |

**Vite override:** `package/folio/vite.cosmos.config.ts` exists for the same reason as editor's. Same disposition — delete after migration.

---

## `@rezics/admin` — 0 fixtures

No fixtures, no `cosmos.config.json`, no decorator. Only:
- `package/admin/package.json` `scripts` → `"cosmos"` and `"cosmos-export"`
- `package/admin/package.json` `devDependencies` → `react-cosmos`, `react-cosmos-plugin-vite`

T8.3 removes those entries and there's nothing else to do for admin.

---

## Migration plan (feeds T8.2)

1. **Rename, don't rewrite.** A Cosmos default-export fixture component is already valid React — converting to CSF is a thin wrapper:
   ```ts
   import type { Meta, StoryObj } from "@storybook/react";
   import { ArrowButton } from "./ArrowButton";

   const meta = { title: "Primitive/Carousel/ArrowButton", component: ArrowButton } satisfies Meta<typeof ArrowButton>;
   export default meta;
   export const Default: StoryObj<typeof ArrowButton> = { args: { /* … */ } };
   ```
2. **Drop `useFixtureInput` calls** — replace with `argTypes` / `args` in the meta. This is the only mechanically non-trivial step.
3. **Drop the cosmos decorator wrappers** — Storybook previews already provide theme + UnoCSS. Where a fixture relied on the cosmos mock router or a QueryClient, add a per-story `decorators: [...]` or extend the package's `preview.tsx`.
4. **Rename rules:**
   - `@rezics/ui`: `*.test.tsx` → `*.stories.tsx` for the 8 Cosmos files (the 4 `bun:test` files keep `.test.tsx`).
   - `@rezics/app` / `editor` / `folio`: `*.fixture.tsx` → `*.stories.tsx`.
5. **After migration (T8.3 / T8.4):**
   - Delete `cosmos.config.json` × 4 (ui/app/editor/folio).
   - Delete `cosmos.decorator.tsx` × 2 (ui/app).
   - Delete `vite.cosmos.config.ts` × 2 (editor/folio).
   - Remove `react-cosmos` + `react-cosmos-plugin-vite` from devDeps in 5 packages (ui/app/editor/folio/admin).
   - Remove `cosmos` / `cosmos-export` npm scripts from 5 packages.

   **Plan note:** the existing T8.3 / T8.4 wording in `design-system.md` only mentions `package/ui`. The actual delete scope is wider (4 packages with config; 5 with devDeps). Worth tightening in the plan or just executing the wider scope under T8.3 / T8.4 — flag at GATE-C.

---

## Risks for the migration

- **Suffix conflict in `@rezics/ui`** — handled by renaming Cosmos files only; `.test.tsx` keeps belonging to `bun:test`.
- **Mock router / QueryClient parity** — easy to forget when dropping the cosmos decorator. Spot-check each migrated story renders without errors.
- **`useFixtureInput` mechanical conversions** — count the call sites first; unlikely to be more than a few dozen total. Use `args` for primitive props and `argTypes` for select-typed props.
- **Visual regression** — none of these fixtures are part of CI. Migration is observation-only; if a story renders, it ships.
