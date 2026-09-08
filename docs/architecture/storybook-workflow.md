# Storybook workflow

Status: Accepted

Owner: Web runtime; UI owns shared component stories.

## Runtime and version policy

Use the Storybook `next` channel and keep official packages at the same resolved
version. The initial integration uses `11.0.0-alpha.0`. Keep the lockfile and any
package patches under version control. Re-evaluate patches when updating `next`;
do not disable experimental features solely because they are experimental.

`apps/web/.storybook/main.ts` owns the single development instance. Its independent
Vite configuration excludes Vinext, Cloudflare and the application's PWA. The
browser test project explicitly imports that same Vite configuration: addon-vitest
applies `viteFinal`, but does not load the builder's `viteConfigPath` automatically.
The `@storybook/nextjs-vite` adapter supplies Next-compatible navigation/module mocks.

The following capabilities are enabled: CSF Next, experimental story tests,
component manifests, server-side docgen, change detection, Agentic Review, Docs,
Vitest Browser, accessibility, MSW, and MCP. Use official skills/tools for agent
orchestration. Hosted visual approval is available through Chromatic when an
account and project are configured; it is not needed for local screenshots.

## Ownership

- Feature stories are colocated `*.stories.tsx` files and import Web's preview.
- Shared component stories live in `libraries/ui/stories` and import its preview.
  They must not import Web providers. CSF Next binds each story to its own preview;
  a separate preview does not automatically inherit the application preview.
- The UI-owned `storyEnvironment` is a native preview addon shared by both previews.
  It supplies the theme, locale/content-language controls, fixture provider, and
  viewport definitions. Application-only translations, auth and query state stay
  in the Web preview. Each story receives an isolated query client.
- Import shared controls through `@rezics/ui`. Never edit the upstream `src/ui`
  mirror to add stories, documentation, or test-only behavior.
- Reuse typed locale resources and fixture data. Keep mock content out of production
  locale resources and keep fixture/story dependencies out of production modules.

## Commands

Run from the repository root:

```sh
task apps-web:storybook
task apps-web:storybook:browsers
task apps-web:storybook:skills -- stories
task apps-web:storybook:skills -- write-story
task apps-web:storybook:tools -- docs list --withStoryIds true
task apps-web:storybook:tools -- stories changed
task apps-web:storybook:tools -- stories find-by-component --help
task apps-web:storybook:test
task apps-web:storybook:tools -- review create --help
task apps-web:storybook:build
task apps-web:storybook:coverage
task apps-web:storybook:visual -- ../../libraries/ui/stories/button.stories.tsx
```

Use `--stories` with the official test tool to focus a run, following its help.
Read `--help` for each command before constructing arguments. Reuse the correct
running instance and take IDs from discovery tools. Return a review for visual
work, including all newly introduced stories. Changes to global CSS, themes,
providers or shared locale resources warrant broader tests than a single component.

The project-scoped Codex MCP configuration points to `http://127.0.0.1:6006/mcp`.
Start Storybook before connecting. In a separate worktree, use a distinct port and
the official CLI from that worktree; do not accidentally inspect the original
checkout's server. Adjust the task's MCP connection to the matching instance when
using MCP there. The CLI and MCP expose the same upstream capabilities.

`apps/web/vitest.config.ts` exposes the Storybook browser project to the official
test runner. `vitest.unit.config.ts` preserves the Web node tests in the root test
suite, so ordinary deterministic checks do not silently start a browser.

## Screenshots and visual assertions

Screenshots use Vitest Browser's native API from the test lifecycle, with a fixed
browser environment. Successful runs produce images too. Names identify the story,
test, locale, theme and actual viewport; story IDs are URI-encoded for Windows-safe
filenames, including CSF Next's colon-separated child test IDs.

Default viewport: 1280 by 900; toolbar alternatives: 390 by 844 and 768 by 1024.
Headless tests disable Vitest's separate canvas UI and size the Playwright context
to fit the largest toolbar viewport (1280 by 1024), avoiding fit-to-panel scaling.
Storybook's own UI and test panel
remain available. Capture the test document body through the native locator API
so portals are included and parallel test frames are not mixed into an image.
Use per-story globals to make an important theme/viewport combination reproducible.
Fix date-dependent scenarios and supply local assets. Unexpected API/external
requests fail through MSW instead of falling through to live development data.

Generated screenshots, failure artifacts, traces, coverage and static builds live
under `.temp/storybook/`. Inspect screenshots before making visual claims. Use
Vitest's `toMatchScreenshot()` for visual regression; review the initial or updated
baseline instead of treating baseline creation as correctness. Pixel comparison,
interaction assertions, accessibility checks and AI visual judgment provide
different evidence. No custom image diff engine or screenshot scheduler is used.

The opt-in `storybook:visual` task enables native comparison in the same lifecycle.
Pass story file filters to limit the run. Reviewed references live in
`apps/web/.storybook/baselines/`, with browser and OS in their native filenames;
diffs stay under `.temp/storybook/diffs/`. Use Vitest's `--update` deliberately when
creating or changing references, inspect the images, then rerun without it.

## Compatibility corrections

TypeScript 7 removed the JavaScript compiler API consumed by Storybook's React
docgen worker. The `@storybook/react` Yarn patch imports a separate
`typescript-docgen` alias at version 6.0.3, supplied by `.yarnrc.yml`. Merely adding
a dependency named `typescript` does not override the renderer's TypeScript peer.
Application and library typechecks continue to use TypeScript 7. Remove this patch
when upstream supports that compiler API boundary or scopes its own parser runtime.

The Web TypeScript `lib` target includes ES2023 because existing application code
uses `toSorted`, `with`, and `findLast`. Storybook integration must not depend on
an incidental dependency to supply those ambient declarations.

When the official test tool starts Vitest, it selects a project named
`storybook:<absolute-config-directory>`. Declare that name when
`VITEST_STORYBOOK=true`, before the addon plugin runs: Vitest can filter inline
projects before the plugin overrides their names. Otherwise the CLI can wait until
its 30-second startup timeout while direct `vitest --project storybook` works.

## Acceptance boundary

For story-covered UI changes, update stories, run affected TypeScript/deterministic
checks, run official Storybook tests, inspect relevant screenshots and create an
official review. This scoped component/browser workflow is maintainer-approved.
Full application browser flows retain their separate task authorization boundary.

Passing these checks establishes integrity and the covered component behavior. It
does not establish full-repository coverage, Vinext SSR/authentication behavior,
production deployment, capacity, or hosted Chromatic acceptance.
