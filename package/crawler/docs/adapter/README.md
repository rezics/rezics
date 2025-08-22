## Adapter Authoring Guide

Adapters turn a site-specific book page into a normalized `Book` object via
`make_strategy`. Optionally, implement discovery with `make_discover` to
enumerate book URLs.

### Responsibilities

- Navigate to the canonical book page URL (validated to match `domain`).
- Ensure page readiness (wait for 200 OK or required selectors).
- Extract all required `Book` fields:
  - `id`: provide at least `{}`; add known IDs if available.
  - `cover`: base64 bytes of the cover image (read from Playwright `Response`
    list).
  - `title`, `authors`, `tags`, `description`.
  - `units`: array of `Unit { title, children?: Unit[] }` representing
    volumes/chapters.
  - `completed`, `length`, `last_update` (ISO), `release` (ISO | null), `rating`
    (0..1 | null).
- Avoid setting `platform` and `link`; the framework injects those.

### Helper APIs

- `make_strategy(platform, domain, extractor)` wraps your
  `extractor(page, url, responses)` and returns a `Strategy`.
- `make_discover(generator)` produces a discovery function that yields `URL`s.
- `make_test(strategy, url)` returns a function to quickly run and print
  results.

### Skeleton

```ts
import { Either } from "effect";
import { make_discover, make_strategy, make_test } from "./base.js";

export const platform = "example";
export const domain = "www.example.com";

export const strategy = make_strategy(
	platform,
	domain,
	async (page, url, responses) => {
		await page.goto(url.toString());

		// extract fields using locators
		const coverSrc = await page.locator("img.cover").getAttribute("src");
		const cover =
			(await responses.find((r) => r.url().endsWith(coverSrc!))!.body())
				.toString("base64");

		return Either.right({
			id: {},
			cover,
			title: await page.locator(".title").innerText(),
			authors: [await page.locator(".author").innerText()],
			tags: await page.locator(".tags a").allInnerTexts(),
			description: await page.locator(".desc").innerText(),
			units: [{ title: "Volume 1", children: [{ title: "Chapter 1" }] }],
			completed: false,
			length: 0,
			last_update: new Date().toISOString(),
			release: null,
			rating: null,
		});
	},
);

export const discover = make_discover(async function* (page, keyword: string) {
	await page.goto(
		`https://${domain}/search?q=${encodeURIComponent(keyword)}`,
	);
	for (
		const href of await page.locator(".result a").allAttributeValues("href")
	) {
		try {
			yield new URL(href!);
		} catch {}
	}
});

export const test = make_test(strategy, `https://${domain}/book/123`);
```

### Patterns and tips

- **Network response to bytes**: Cover images often require resolving relative
  URLs and matching by `endsWith` or absolute equality.
- **Text-only node content**: When titles mix text and tags, use
  `Element.childNodes` and take `Text` nodes to avoid embedded tags.
- **Pagination/discovery**: Await URL change or content change before clicking
  next to avoid tight loops.
- **Length parsing**: Normalize units (万 → × 10,000) and strip non-digits
  before parsing.
- **Timestamps**: Convert site-local strings to ISO with
  `new Date(...).toISOString()`; be mindful of locales.
- **Robust waits**: Prefer explicit conditions (e.g., expected selector count)
  over arbitrary sleeps; if needed, retry with backoff.
- **Errors**: Return `Either.left(message)` from inside extractor when you want
  a typed failure; unexpected exceptions are caught and mapped to left by the
  wrapper.

For the framework details (`make_strategy`, `make_discover`, `make_test`), see
`adapter/base.md`.
