## Crawler Package Documentation

This package is a headless browser-based book metadata crawler built on top of
`rebrowser-playwright`. It extracts normalized `Book` records from different
platforms via pluggable adapters, with consistent typing and a database writer
for SurrealDB.

### Contents

- [Crawler Package Documentation](#crawler-package-documentation)
  - [Contents](#contents)
  - [Docs tree](#docs-tree)
  - [Overview](#overview)
  - [Project structure](#project-structure)
  - [Data model (Schema)](#data-model-schema)
  - [Runtime flow and core APIs](#runtime-flow-and-core-apis)
  - [Drivers](#drivers)
  - [Adapters (per-site)](#adapters-per-site)
  - [Writing to SurrealDB](#writing-to-surrealdb)
  - [How to run and test](#how-to-run-and-test)

### Docs tree

```
docs/
  README.md                 # This file
  schema.md                 # Book/Unit schema reference
  driver/
    README.md               # Browser drivers and context notes
  adapter/
    README.md               # Adapter authoring guide
    base.md                 # Core adapter APIs
    ciweimao.md             # Site adapter docs: www.ciweimao.com
    fanqienovel.md          # Site adapter docs: fanqienovel.com
    qidian.md               # Site adapter docs: www.qidian.com
```

### Overview

- **Goal**: Convert a platform-specific book page into a normalized `Book`
  object.
- **How**:
  - A site-specific adapter implements an extraction strategy using Playwright
    selectors.
  - The framework wraps it with shared behaviors: domain validation, anti-bot
    context, response capture, error handling, and final mapping to the `Book`
    schema.
  - Optional discovery iterates search/listing pages to enumerate book URLs.
  - Output can be written to SurrealDB with relationships to authors, tags, and
    platform.

### Project structure

```
src/
  lib/
    adapters/
      base.ts          # Adapter helpers: make_strategy, make_discover, make_test
      ciweimao.ts      # Adapter for www.ciweimao.com
      fanqienovel.ts   # Adapter for fanqienovel.com
      qidian.ts        # Adapter for www.qidian.com
    drivers/
      chromium.ts      # Launch configured Chromium (Rebrowser Playwright)
      firefox.ts       # Launch Firefox
    util.ts            # Tiny helpers (sleep, exec)
  schema.ts            # Zod Book schema and JSON Schema export
  write.ts             # SurrealDB writer for crawled Book
```

### Data model (Schema)

- Defined via Zod in `src/schema.ts` and exportable as JSON Schema (Draft-7).
- Key fields of `Book`:
  - `id`: `{ isbn?: string(13), icsid?: string }`
  - `cover`: base64-encoded image bytes
  - `title`: string
  - `authors`: string[] (non-empty names)
  - `units`: hierarchical table of contents; array of
    `{ title, children?: Unit[] }`
  - `platform`: adapter/platform name
  - `link`: canonical URL (validated and cleaned of search params)
  - `tags`: string[]
  - `description`: string
  - `release`: ISO datetime | null
  - `completed`: boolean
  - `length`: number (characters/words; adapter-dependent; see adapter docs)
  - `last_update`: ISO datetime
  - `rating`: 0..1 | null

### Runtime flow and core APIs

Core helpers live in `lib/adapters/base.ts`:

- `make_strategy(platform, domain, extractor)` → returns
  `(driver, url) => Promise<Either<Book,string>>`
  - Validates the URL host equals `domain`.
  - Cleans URL search params.
  - Creates a hardened Playwright context (`make_context`): sets desktop
    userAgent and hides `navigator.webdriver`.
  - Opens a page, sets viewport, records all network `Response`s for later asset
    lookup (e.g., cover images).
  - Calls site-specific `extractor(page, cleanUrl, responses)` to build
    `Omit<Book,'platform'|'link'>`.
  - On success, injects `platform` and `link` and returns `Either.right(Book)`;
    otherwise returns `Either.left(errorMessage)`.

- `make_discover(async function* (page, ...params) { ... })`
  - Creates a discovery factory that yields `URL`s using a dedicated
    context/page.

- `make_test(strategy, url)` → `() => Promise<string>`
  - Utility that runs a strategy against a sample URL and returns a pretty JSON
    stringified result.

### Drivers

- Implemented in `lib/drivers` using `rebrowser-playwright`:
  - `chromium.ts`: launches Chromium with `{ headless: false, timeout: 0 }` for
    interactive debugging and no global timeout.
  - `firefox.ts`: simple Firefox launcher.
- All strategies/discovery run within a fresh `BrowserContext` via
  `make_context` to reduce bot detection.

### Adapters (per-site)

See detailed pages:

- [Ciweimao](./adapter/ciweimao.md) — `www.ciweimao.com`
- [Fanqienovel](./adapter/fanqienovel.md) — `fanqienovel.com`
- [Qidian](./adapter/qidian.md) — `www.qidian.com`

Each adapter documents:

- Page navigation and readiness conditions
- Selectors used to extract each `Book` field
- TOC construction strategy (`units`)
- Completion heuristics, length parsing, timestamp normalization
- Optional discovery strategy
- A `test` example URL

### Writing to SurrealDB

`src/write.ts` persists a `Book` to SurrealDB and relates it to `author`, `tag`,
and `platform` records:

- Creates or upserts `author` and `tag` entities from arrays.
- Ensures a `platform` record with `name` (adapter/platform) and `domain`
  (parsed from `link`).
- Creates the `book` content (mapping `units` → `unit`, and `link` →
  `grabbed_from`).
- Relates `book` → `author` (`r_author`), `book` → `tag` (`r_tag`), `book` →
  `platform` (`r_platform`).
- Note: `id`, `completed`, and `rating` are currently not written to DB content
  object by design.

Required environment variables for DB connection:

- `SURREAL_URL`, `SURREAL_NAMESPACE`, `SURREAL_DATABASE`, `SURREAL_SCOPE`,
  `SURREAL_USER`, `SURREAL_PASS`

### How to run and test

Prerequisites: Node 18+, pnpm, browsers for Playwright (Rebrowser flavor).

Install dependencies at repo root (workspace) or within the package:

```bash
pnpm install
# or, within package/crawler
cd package/crawler && pnpm install
```

Run an adapter test snippet (examples are embedded in adapter files guarded by
`process.env["TEST"]`):

```bash
cd package/crawler
TEST=1 node --loader tsx ./src/lib/adapters/ciweimao.ts
```

Programmatic usage example:

```ts
import { strategy as qidian } from "./src/lib/adapters/qidian.js";
import { chromium } from "./src/lib/drivers/chromium.js";

const run = async () => {
	const result = await qidian(
		chromium,
		new URL("https://www.qidian.com/book/1032982789"),
	);
	console.log(result);
};
run();
```

Write to SurrealDB after crawling:

```ts
import type { Book } from "./src/schema.js";
import { write } from "./src/write.js";

// assuming `book` is a validated Book object
await write(book as Book);
```

For adapter authoring guidance, see [adapter/README.md](./adapter/README.md) and
[adapter/base.md](./adapter/base.md).
