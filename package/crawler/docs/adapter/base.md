## Adapter Base (Core APIs)

This module defines the primitives that all adapters use. It standardizes
context hardening, domain validation, response capture, error mapping, and final
`Book` assembly.

### Strategy

```ts
type Strategy = (driver: Browser, url: URL) => Promise<Either<Book, string>>;
```

Create a strategy with:

```ts
make_strategy(
  platform: string,
  domain: string,
  extractor: (page: Page, url: URL, responses: Response[]) => Promise<Either<Omit<Book,'platform'|'link'>, string>>
): Strategy
```

Behavior:

- Validates `url.hostname === domain`; otherwise returns `Either.left` with a
  helpful message.
- Produces a clean canonical URL by removing all search params.
- Creates a hardened `BrowserContext` (`make_context`):
  - Sets a desktop Chromium UA.
  - Deletes `navigator.__proto__.webdriver` to reduce detection.
- Opens a page, sets viewport to 1920×1080.
- Subscribes to `page.on('response', ...)` to collect all `Response`s for
  adapter consumption.
- Invokes your `extractor` and, on success, injects `{ platform, link }` into
  the result.
- Ensures the page is closed; maps thrown errors to `Either.left(message)`.

### Discovery

```ts
make_discover<T extends any[]>(discover: (page: Page, ...params: T) => AsyncGenerator<URL>)
  -> (driver: Browser, ...params: T) => Promise<AsyncGenerator<URL>>
```

- Creates a discovery factory that provides a fresh `BrowserContext` and `Page`
  and returns your generator. Use it to paginate search/listing pages and
  `yield` canonical book URLs.

### Testing helper

```ts
make_test(strategy: Strategy, url: string) => () => Promise<string>
```

- Dynamically imports the Chromium driver and runs `strategy` on `url`,
  returning a pretty-printed JSON string. Useful inside adapter files under
  `if (process.env['TEST'])` blocks.

### Code locations

- `src/lib/adapters/base.ts`: strategy/discover/test and context hardening
- `src/lib/drivers/*`: browser launchers used with strategies
- `src/schema.ts`: `Book` and `Unit` types used by strategies

### Notes

- Strategies should avoid global state. Always rely on the provided `responses`
  array for assets.
- Always close/allow the wrapper to close the page; never hold a reference
  outside `extractor`.
- Only return `Either.right` when all required fields are present and
  normalized.
