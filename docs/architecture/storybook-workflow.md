# Storybook workflow

Status: Accepted. The [AI review skill](../../.agents/skills/storybook-ui-review/SKILL.md)
owns evidence and completion policy. Screenshots support inspection of new and
changed UI; persistent pixel baselines are not part of the default workflow.

## Runtime owners

| Host | Stories and providers |
| --- | --- |
| Web | `apps/web/features`, `libraries/ui/stories`, `packages/editor/stories`. Next-compatible Vite, typed translations, isolated queries and explicit MSW handlers. Library previews do not inherit Web providers. |
| REZICS Text | `apps/rezics-text/packages/app/src`. Real application CSS and in-memory document storage; no Tauri filesystem calls. |
| About | `apps/about/src/components`. React islands with About CSS and locale content; Astro pages retain their owning checks. |

Keep stories beside their owner and outside the upstream SharkUI mirror. Preserve
production/fixture isolation, real theme tokens, typed locales and independent Vite
configurations. Do not load Vinext, Cloudflare or PWA plugins into Storybook.
The [frontend plan](../plan/frontend.md) owns remaining experience coverage;
screenshots are scoped inspection evidence rather than completion counters.

## Aspire lifecycle

From the repository root:

```sh
task aspire:storybook
task aspire:describe
task aspire-apphost:stop
```

The rooted TypeScript AppHost supports `REZICS_ASPIRE_MODE=storybook`, which starts
only `storybook-text`, `storybook-about` and `storybook-web`. It does not require
application credentials, start infrastructure or prepare a database. To include
these resources with normal development, set `REZICS_ASPIRE_STORYBOOK=true` before
`task dev`. The existing application smoke mode excludes them.

Aspire allocates HTTP ports and injects `STORYBOOK_PORT`. Each owner's
`storybook:aspire` script uses Yarn's portable shell to pass it to the official CLI.
Endpoint references supply `STORYBOOK_URL` and Composition URLs. Web waits for
Text and About readiness because reference discovery happens at startup. Dashboard
resources expose HTTP, MCP and Review links. Storybooks are excluded from publish
manifests.

Use `task aspire:storybook -- --isolated` for isolated development. Discover actual
URLs from `task aspire:describe`; never guess ports or inspect another checkout.
`task aspire-apphost:storybook:smoke` verifies startup, indexes, MCP tool discovery
and clean shutdown in an isolated topology without database settings. It refuses
to replace an already-running AppHost for this checkout.

Standalone tasks (`apps-web:storybook`, `apps-rezics-text:storybook`,
`apps-about:storybook`) remain available for troubleshooting, with defaults 6006,
6008 and 6009. Reuse the correct running instance rather than creating a duplicate
outside Aspire.

## Agent tools and on-demand images

Connect the task's MCP client to the discovered resource's `/mcp` URL. The repo
has no fixed Codex MCP URL because isolated ports vary. If a client cannot attach
dynamically, use the equivalent official CLI from the owning package with
`--port <discovered-port> --attach`.

Read `storybook skills` and tool help for the installed version. Use official
docs, `stories changed` and `stories find-by-component` to select relevant stories.
An empty changed selection is not evidence of no impact. Expand consumer coverage
for shared styles/providers. The alpha watcher may need a host restart when new
external-workspace files appear; compare discovery with the selected test results.

`stories preview` returns preview URLs, not PNG files. Use available browser tools
to capture selected states. Review thumbnails show initial renders; open the detail
and perform interactions when a later state matters. The AI must view the images.

The opt-in native capture fallback is available when browser tooling is insufficient:

```sh
task apps-web:storybook:capture -- features/editor/portable-text-editor.stories.tsx
task apps-rezics-text:storybook:capture -- packages/app/src/rezics-text-app.stories.tsx
task apps-about:storybook:capture -- src/components/SiteHeader.stories.tsx
```

Capture requires an explicit file selection and uses Vitest Browser's native API.
Artifacts live under `.temp/storybook/`; body locators include portals and filenames
identify story, locale, theme and viewport. Use a fixed environment and reach the
intended state. Generated reference images, screenshots and diffs are never
committed. Product image assets are unaffected.

## Tests and CI

Normal `storybook:test` tasks use the official Vitest addon without a running server
and without capturing successful tests. MCP and `storybook:tools` can test an
already-running instance. Native failure screenshots and traces remain available. Run
affected typechecks and deterministic checks. `task storybook:check` deliberately
runs all three suites when broad verification is warranted; small edits do not
require it.

Node projects remain separate from browser projects. `storybook:coverage` and
`storybook:build` remain available when needed. The advisory GitHub workflow runs
owner types, component/a11y tests and static builds, retaining structured results
and failure diagnostics. It does not compare pixels or update baselines.

## Version and compatibility

Follow `storybook@next`, retaining applicable official capabilities and reproducible
patches. CSF Next/child tests, manifests/docgen, change detection, Docs, Vitest,
a11y, Review and MCP remain enabled. Availability does not require invoking every
capability in every task. Do not build replacement dependency graphs, screenshot
schedulers, diff engines or review applications.

Current scoped integration corrections:

- React docgen uses a separate TypeScript 6 JavaScript API alias; application
  typechecking remains TypeScript 7.
- The Next Vite adapter maps `react/compiler-runtime` for compiled editor imports.
- The embed freezer permits layout frames before freezing; native loaders preload
  lazy editors. Upstream initial-state thumbnail semantics are retained.
- Web prebundles native-i18n entry points together to preserve symbol identity.
- Preserve the early `storybook:<configDir>` Vitest project name, independent Vite
  config, typed capture injection and unscaled browser viewport. Attached and direct
test runners have separate optimizer caches.
- CodeMirror extension objects stay in renderers rather than serializable args.
  Editor stories use official user-event typing cadence for manager replay.

Re-evaluate patches on upgrades. Keep alpha diagnostics visible. Composition
navigation does not prove cross-host MCP manifests work; use each host's direct
tools. Full application E2E, real authentication, Tauri/native behavior, deployment
and capacity remain outside component acceptance.

The alpha offline `storybook tools test run --no-attach` bridge can fail to create
its status-store leader. Independent tasks and CI use the documented native
Vitest addon entry instead; server-connected MCP/CLI tools remain enabled.
