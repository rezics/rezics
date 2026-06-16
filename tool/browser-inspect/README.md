# Browser Inspect Workbench

This workbench is for agent-led investigation of live URLs when normal
fetch/headless inspection is not enough: Cloudflare checks, login flows,
captcha, consent screens, or user-provided Playwright selectors that need a real
headed browser.

It is not a stable flag-driven CLI. Keep reusable browser/session/style helpers
in `src/`, then write task-specific scripts in `work/`. The `work/` directory is
ignored so each investigation can use direct Playwright code without creating
repo churn.

```sh
task browser:inspect -- current.ts
```

The command above runs `tool/browser-inspect/work/current.ts`. You can also pass
an absolute or repo-relative path inside `tool/browser-inspect/work/`.

## Agent Flow

1. Copy `template.ts` or create a new script under `work/`.
2. Import helpers from `../src`.
3. Open the target URL with `openInvestigationPage`.
4. Use normal Playwright code such as `page.locator(...)`,
   `page.getByText(...)`, or CSS selectors.
5. If the page is blocked by Cloudflare, login, captcha, or consent, ask the
   user to complete the browser flow and press Enter in the terminal.
6. Highlight the target, dump the locator summary/style data, and report the
   findings.

The browser uses the ignored `profile/` directory as a persistent profile so
verification and login state can survive between scripts. The default helpers do
not close the headed browser automatically; leave it available for screenshots,
DevTools, and manual DOM/CSS copying unless the user asks to close it.
