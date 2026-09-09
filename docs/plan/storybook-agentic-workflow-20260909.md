# Storybook agentic workflow

Status: Implemented and verified on 2026-09-09.

Historical acceptance record. The screenshot/baseline operating policy below is
superseded by [AI UI review](storybook-ai-review-20260909.md); it does not prescribe
future tasks. The six historical image references are removed from current Git tracking.

Owner: Web, with shared component stories owned by UI.

## Objective and authorization

Introduce the Storybook `next` release channel as REZICS's component development,
testing, screenshot, and agent review environment. Prefer official capabilities,
including preview and experimental features, over project-specific replacement
infrastructure. Resolve integration problems rather than dropping features merely
because they are experimental.

The maintainer approved implementation, browser/component/screenshot acceptance,
and a commit after this plan is complete. After that commit, create a separate
task to review the whole repository, identify appropriate Storybook coverage, and
implement the broader workflow. That follow-up is not a claim that this initial
integration covers the whole repository.

## Selected approach

- Resolve `storybook@next` and keep first-party framework/addon versions aligned.
  The research baseline is `11.0.0-alpha.0`; record the actual installed version
  and lock dependencies for reproducibility while continuing to follow `next`.
- Use one development instance owned by `apps/web`. Evaluate
  `@storybook/nextjs-vite` first to reuse official Next-compatible routing and
  module mocks for Web's existing imports. Keep Vinext/Cloudflare/RSC/PWA build
  plugins out of the Storybook Vite configuration. Storybook acceptance does not
  qualify the actual Vinext server, authentication, or deployment runtime.
- Use CSF Next, including its experimental story test syntax. Enable component
  manifests, change detection, experimental server-side docgen, and Agentic
  Review. Use the newer docgen service instead of the superseded code-example
  flag. Keep built-in controls, actions, interactions, viewports, backgrounds,
  measure, outline and toolbars available.
- Install official Docs, Vitest, accessibility, and MCP integrations. Reuse
  `storybook skills` and `storybook tools` for agent instructions, component
  discovery, affected-story selection, tests, previews, and review creation.
- Reuse Vitest Browser's Playwright provider, screenshot API, visual assertions,
  coverage, and diagnostic artifacts. Do not build a second screenshot scheduler,
  dependency graph, visual diff engine, or review application.
- Configure project-specific theme, locale, content language, viewports, providers,
  mock data, and test lifecycle. Only introduce glue required to connect existing
  facilities. Keep test state and query caches isolated between stories.
- Keep shared UI stories outside the upstream `libraries/ui/src/ui` mirror.
  Feature stories stay with their feature. Preserve production/fixture dependency
  boundaries and the package-root `@rezics/ui` import policy.
- Use native/component mocks and deterministic network handlers for API-backed
  scenarios. Never require a database reset or live API for component acceptance.
- Chromatic is the official option for hosted visual regression and team review.
  Account/project setup is an external integration, not required to produce local
  screenshots, agent review, or this initial completion.

## Implementation sequence

1. Establish the configuration, official agent tools, feature flags, independent
   browser test project, Taskfile commands, and maintainer workflow documentation.
2. Run a shared component and a real Feed component through rendering, interaction,
   accessibility, screenshot, metadata lookup, and review. Fix actual integration
   failures, using a tracked package patch only when an upstream defect requires it.
3. Migrate all four Cosmos fixture files (fourteen named scenarios), retaining
   scenario meaning and introducing explicit upload phases. Reuse fixture content
   and translation resources; migrate shared test-only rendering support without
   importing story files into production or other story files.
4. Add representative shared UI coverage for button, card, choice select, cover,
   identity avatar, query state, and a portal/overlay interaction. Keep scope bounded
   to the initial integration; the next task inventories broader coverage.
5. Validate deterministic integrity and rendered behavior, record exact evidence
   below, remove Cosmos-only configuration/dependencies, and commit the completed
   change. Then create the requested repository-wide follow-up task.

## Acceptance

- Web and UI TypeScript checks, relevant fixture/domain checks, and a Storybook
  static build pass. No failing integrity check is concealed by excluding code.
- Stories use actual application/shared components, real theme tokens, and typed
  localization. Theme/locale changes and direct story links work.
- Migrated scenarios render without unexpected network requests or framework errors.
  Real interactions include a Feed control and an overlay's open/close/focus path.
- The Storybook Vitest integration executes component tests and accessibility
  checks. CSF Next `.test` runs. Screenshot output is available for the agent on
  successful runs, not only when tests fail; visual comparison uses native APIs.
- At least desktop and mobile examples are inspected. Screenshot identity records
  the story and viewport/theme/locale through native test names or metadata.
- Component docs are discoverable through official tools. Shared workspace imports
  and relevant props appear correctly. Affected-story lookup and Agentic Review
  return real stories and a usable review URL. MCP is reachable locally.
- Production fixture isolation remains enforced, including the new development
  surfaces. The upstream SharkUI mirror is untouched.
- Report precise limits: no whole-repository coverage, full application E2E,
  capacity, deployment, or hosted Chromatic acceptance is implied.

## Agent operating policy

For story-covered UI changes, the accepted workflow is to consult official
Storybook documentation/tools, update stories, run the affected deterministic and
browser/component checks, inspect relevant screenshots, and produce an official
review. Full-application browser flows retain their separate authorization and
acceptance boundary. Use the repository Taskfile and owning package directory;
reuse the correct existing Storybook server instead of duplicating it.

Fixes should retain the selected feature set. If a feature truly cannot work,
record the exact failing version, reproduction, and remaining limitation rather
than silently disabling it. Project-specific patches must be reproducible and
explain the upstream defect and their removal condition.

## Evidence and completion record

Implemented with Storybook `11.0.0-alpha.0`, Next.js Vite, CSF Next, the five
selected feature flags, Docs, MCP/official tools, MSW 3, and Vitest Browser 4.1.10.
Ten story files contain 38 regular stories and three CSF Next child tests. All
fourteen original Cosmos scenarios are represented; Cosmos dependencies and
configuration have been removed.

| Check | Evidence |
| --- | --- |
| Web and UI integrity | `task apps-web:typecheck` and `task libraries:ui:typecheck` passed, including the new stories and support files. |
| Browser component tests | Official `storybook tools test run --attach` completed 41 tests, with 41 successes and zero errors. |
| Accessibility | The same run completed 41 a11y checks, with zero warnings and zero errors; portal content is included through the body context. |
| Deterministic behavior | 79 focused Feed/fixture-boundary tests passed; the final theme, Feed-card and fixture-boundary subset passed all 23 tests. |
| Native visual comparison | Six Button baselines were inspected and verified through `storybook:visual`. An intentional action-color change produced an 849-pixel difference before updating the reference. Final references use unscaled 1280 by 900 rendering. |
| Screenshots | Inspected desktop Feed, 390 by 844 dark Feed, brand/focus/disabled buttons, and the open share dialog. Verified native PNG dimensions, including the 1280 by 900 portal capture. |
| Static build | `task apps-web:storybook:build` passed, including open-service/docgen output. |
| Metadata | Official docs tools returned the actual Button prop unions/defaults and resolved its package-root import. Component lookup found all 41 entries across ten files with no missing paths. |
| MCP | Initialized the local Streamable HTTP endpoint, listed nine tools, and called `docs-list` successfully. Project-scoped Codex configuration parses successfully. |
| Review | Official `review create` produced four groups with all 41 entries. Verified thumbnail completion, group expansion, and navigation to the Brand detail. |
| Coverage | Native V8 coverage executed successfully; external workspace source is included and story/support files are excluded from the configured report. This is feature verification, not a coverage target claim. |

### Corrections found by acceptance

- Reused the independent Vite configuration in browser tests so Tailwind is
  actually compiled there. The computed-style story caught the initially
  unstyled test runtime.
- Shared CSF Next preview environments through a native preview addon, retaining
  library independence from Web providers.
- Declared the native test project's selected name before Vitest filters projects,
  resolving the official tool's startup timeout without replacing its runner.
- Scoped a TypeScript 6 JavaScript API alias to the React docgen worker using a
  three-line Yarn patch. Application typechecking remains TypeScript 7.0.2.
- Used typed Vitest `provide`/`inject` for screenshot controls, with URI-safe story
  IDs and native locator screenshots. Sized the headless browser context for the
  largest viewport to prevent iframe scaling and backdrop painting artifacts.
- Added an accessible name to Feed identity-avatar links. Added contrast-qualified
  `brandText` and `brandAction` roles for the affected labels, selected vote counts,
  and brand buttons; the approved identity/primary palette remains unchanged.
- Updated two stale Feed unit-test URL expectations to the current publishing
  catalog route; no legacy route was restored.

### Explicit remaining boundaries

- The whole-repository SharkUI audit still fails on existing findings in 79 files
  outside this change and the pre-existing `./ui/*` package export. None of the
  reported source files overlaps the changed source files, and the upstream mirror
  has no diff. The audit was not weakened. The repository-wide follow-up must take
  this baseline into account.
- The alpha Review manager logs source-identification diagnostics for its isolated
  embed iframes. Thumbnail completion and detail navigation work; no other page
  errors were observed. One cold CLI docgen invocation also ended with a Windows
  Node/libuv shutdown assertion after returning its result; subsequent structured
  CLI queries, MCP queries, and static builds passed. These upstream/runtime
  diagnostics are recorded rather than claimed fixed.
- The MSW addon declares a `>=9` peer range, which Storybook warns about for an
  alpha version; its actual CSF Next/browser integration passed the checks above.
- The changed-stories CLI returned an empty selection in this setup. The official
  component-to-story lookup successfully found all 41 entries and supplied the
  review. Do not treat an empty changed selection as proof that no stories are
  affected; use the documented official discovery fallback.
- Full-repository coverage, full Vinext application E2E, deployment and hosted
  Chromatic are outside this initial acceptance. The requested next task starts
  after the implementation commit.

## Sources

- [Storybook next baseline](https://github.com/storybookjs/storybook/releases/tag/v11.0.0-alpha.0)
- [Feature flags](https://storybook.js.org/docs/api/main-config/main-config-features)
- [CSF Next](https://storybook.js.org/docs/api/csf/csf-next)
- [Next.js Vite framework](https://storybook.js.org/docs/get-started/frameworks/nextjs-vite/)
- [Storybook MCP](https://storybook.js.org/docs/ai/mcp/overview)
- [Agentic Review](https://storybook.js.org/docs/ai/agentic-review)
- [Vitest Browser screenshots](https://v4.vitest.dev/api/browser/context)
- [Vitest visual assertions](https://v4.vitest.dev/api/browser/assertions#tomatchscreenshot)
