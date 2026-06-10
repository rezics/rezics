---
name: browser-inspect
description: Use the repo headed Playwright workbench to investigate live URLs, selectors, locators, text matches, computed styles, and pages blocked by Cloudflare/login/captcha flows.
metadata:
  version: 0.1.0
  license: AGPL-3.0-only
---

Use this skill when the user asks to investigate a URL with browser state,
selectors, Playwright locators, exact text, screenshots, computed styles, or a
page that may be blocked by Cloudflare, login, captcha, consent, or other human
verification.

## Tooling

The workbench lives at `tool/browser-inspect/`.

- Reusable helpers: `tool/browser-inspect/src/`
- Starter script: `tool/browser-inspect/template.ts`
- Ignored scratch scripts: `tool/browser-inspect/work/`
- Persistent browser profile: `tool/browser-inspect/profile/`
- Runner: `task browser:inspect -- <script.ts>`

Write task-specific Playwright code in `tool/browser-inspect/work/`. Do not put
one-off investigation scripts elsewhere and do not commit them.

## Flow

1. Create or update a scratch script under `tool/browser-inspect/work/`.
2. Import helpers from `../src`.
3. Open the URL with `openInvestigationPage`.
4. Use the user's exact targeting style when possible:
   - `page.locator('p:has-text("...")')`
   - `page.getByText("...")`
   - traditional CSS selectors through `page.locator(".selector")`
5. If the page shows Cloudflare, login, captcha, consent, or other human gates,
   keep the headed browser open and ask the user to complete the flow, then
   press Enter in the terminal.
6. Highlight the selected locator and inspect it with
   `collectLocatorSummaries` and `dumpElementStyle`.
7. Report the DOM/style findings back to the user with the exact locator used.

## Constraints

- Prefer ordinary fetch/headless inspection first when no browser state is
  needed.
- Use this headed path when the user explicitly asks for browser-backed
  selector/style inspection or when headless access is blocked.
- Do not try to bypass anti-bot systems. The headed browser exists so the user
  can complete verification.
- Do not automatically close the browser. The user may need screenshots,
  DevTools, or manual DOM/CSS copying. Close only when the user asks or the
  investigation is clearly complete.
- Keep scratch scripts in the ignored `work/` directory. If a useful pattern
  becomes reusable, move the durable helper into `src/` and keep the one-off
  script disposable.
