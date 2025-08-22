## Drivers

Drivers wrap `rebrowser-playwright` browser launchers. Use them to create a
`Browser` and pass into strategies and discovery functions.

### Chromium

- File: `src/lib/drivers/chromium.ts`
- Launch options: `{ headless: false, timeout: 0 }` for interactive debugging
  and no global timeout.
- Typical usage:

```ts
import { strategy as qidian } from "../lib/adapters/qidian.js";
import { chromium } from "../lib/drivers/chromium.js";

const res = await qidian(
	chromium,
	new URL("https://www.qidian.com/book/1032982789"),
);
```

### Firefox

- File: `src/lib/drivers/firefox.ts`
- Simple `await f.launch()`.

### Context hardening

- Strategies call `make_context` (in `adapter/base.ts`) to create a
  `BrowserContext` with:
  - A desktop Chrome UA.
  - `delete navigator.__proto__.webdriver` to avoid bot detection.
- The hardened context is used for both strategy and discovery executions.
