# Repository Storybook coverage

Status: Implemented; final acceptance recorded below. Baseline: `272f8da10`.

Historical coverage/acceptance record. [AI UI review](storybook-ai-review-20260909.md)
supersedes its baseline storage, automatic screenshot and standalone lifecycle
policy. Recorded checks describe the earlier run, not requirements for every edit.

## Runtime audit and decisions

The audit covers all three applications, all libraries, packages and all 51 Web feature
owners. Storybook is for independently renderable browser UI and its observable
states. A directory count is not a test target: shared controls and composed
behavior receive stories; route adapters and pure data code retain owning tests.

| Owner | Existing surface and selected workflow |
| --- | --- |
| Web | Keep the Next-compatible Vite instance. Reuse auth, query, typed translations, MSW and fixture providers. Add stateful feature stories below. |
| `libraries/ui` | Keep the independent library preview inside Web. Retain six initial component families; extend project-owned behavior, especially rich text and selection. Do not duplicate every upstream SharkUI demo or modify its mirror. |
| `packages/editor` | Browser CodeMirror and Portable Text surfaces belong in library stories hosted by Web. Test editing, controlled updates and read-only behavior; parsing, serialization and conversion remain unit tests. No separate server is needed. |
| REZICS Text | Independent React Vite instance: application CSS changes body overflow, editor typography and full-screen layout. Use the real app with a per-story in-memory implementation of `MarkdownDocumentStorage`. Test open/edit/save, errors, source/preview and preferences. Never import Tauri adapters. |
| About | Independent React Vite instance for SiteHeader and ProductStageBadge. Use About's own CSS, six-locale copy and public assets. Test responsive navigation, theme persistence, language menu and stage semantics. Astro page/layout/MDX/SEO rendering remains Astro check/build and existing dist tests. |
| `libraries/email` | React Email produces complete HTML documents and plain text on the server. Existing render tests own escaping, links and text. Browser React stories would not qualify Gmail/Outlook layout and would render nested document elements incorrectly; no Storybook instance. |
| `libraries/portable-text`, `block`, `avatar` | Pure schema/serialization/model/SVG generation owners; rendered consumers are in UI/Web. Keep deterministic tests here, stories at those consumers. |
| Other libraries; `packages/api`, `atlas`, `brand` | No independent interactive browser renderer. Generated clients, access, filter, localization, reference, slug and observability code use unit/contract checks. Brand assets are exercised by actual UI. |
| Services, Aspire, infrastructure, deploy, Tauri Rust | Server, orchestration or native host behavior. No Storybook renderer; their integration/native/operational checks remain authoritative. |

Separate CSS runtimes use official Composition, enabled only when explicitly
configured with their URLs. A composed sidebar does not merge test projects or
provider state. Official discovery/test/review commands must target the owning
instance. Shared tooling centralizes native Vitest screenshot and compatibility
configuration; it does not schedule screenshots or implement a graph/diff/review.

## Web feature inventory

Every feature directory is included below. The state column names valuable
component scenarios and distinguishes reusable coverage from route integration.
Follow-up component work in each owner uses its colocated story workflow; this
inventory does not promise exhaustive permutations of every page.

| Owners | Story boundary and valuable states |
| --- | --- |
| `content-feed`, `media` | Existing Feed cards/lists, vote/follow/share and upload phases retained. Add behavior only where the existing 41 checks do not cover it. |
| `editor`, `content-language-display` | Implemented: real localized Portable Text adapter typing, toolbar and synchronized document preview; shared content conceal/reveal; separate core read-only/editing contracts. |
| `slugs` | Implemented: assignment, reserved input, completed assignment, mutation pending and failed submission. |
| `status-pages` | Implemented: error retry, forbidden and missing-page navigation. |
| `following`, `favorites`, `auth` | Anonymous authentication handoff and query loading/failure; authenticated mutations need explicit session/MSW data. Actual login/Turnstile remains integration acceptance. |
| `search`, `content-language-support`, `content-languages` | Query/filter controls, language fallback and choice behavior; backend relevance and URL hydration remain unit/integration checks. |
| `reviews`, `polls`, `progress` | Implemented: optional/locked score input; anonymous, closed, hidden-result, loading and retry poll states. Progress controls reuse shared controls; draft and authenticated mutation permutations remain candidates for future changes. Aggregation/concurrency remains server evidence. |
| `application-shell`, `preferences`, `settings` | Navigation/locale/theme controls, keyboard/overlay focus; provider initialization and persisted application routing remain owning tests. |
| `units`, `catalog`, `catalog-definitions`, `catalog-semantics`, `catalog-sources`, `entities` | Native content and metadata fields, picker empty/loading/error and controlled selections. Route/API composition is covered by existing domain tests; stories attach to concrete fields and cards. |
| `content-structure`, `blocks`, `block-composition`, `docks`, `zones` | Shared tree/editor/list layout and block presentation. Nested save/reorder/server permission paths require their contract checks. |
| `collections`, `posts`, `realms`, `profiles`, `tags` | Reuse cards, editors, identity, pickers and query states; unique composer forms warrant colocated stories when changed. Do not clone every route as a static story. |
| `governance`, `participation`, `privacy`, `presentation`, `preview-access`, `realm-publications` | Permission/required/disabled states and confirmation controls. Authorization is enforced and tested on the server; a disabled control is not security proof. |
| `history`, `reports`, `notifications`, `messages` | Read-only timeline/message/error presentations and retry/confirmation states; delivery and real-time behavior remain integration checks. |
| `create`, `explore`, `recommendations`, `music`, `console` | Reuse shared selection, cards, query states and management shell. Playback/media APIs, dashboards and whole-page orchestration need their dedicated integration acceptance. |
| `seo`, `pwa` | Head metadata, service worker and offline lifecycle have no isolated React visual contract; existing deterministic/build/runtime checks apply. |

## Acceptance record

The repository now has 27 story files: 24 in the Web host, one for REZICS Text and
two for About. These contain 96 regular stories and five CSF Next child tests,
101 checks in total. The initial 41 checks remain; this change adds 17 files and
60 checks. Storybook's registry still resolves `next` to `11.0.0-alpha.0`, verified
with `yarn npm info storybook --fields dist-tags --json` on 2026-09-09.
The [per-story acceptance record](storybook-repository-coverage-20260909.results.json)
retains the official discovered/tested IDs, counts and run times. Its generation
checks that every discovered entry appears in the passing test results.

| Implemented owner | Checks | Observable behavior |
| --- | ---: | --- |
| Web shared UI | 29 | Existing buttons/cards/choice/avatar/cover/query states, native select light/dark, asynchronous entity selection including preloaded and excluded results, overflow disclosure and spoiler reveal. |
| Editor package | 5 | CodeMirror editing/empty/read-only and Portable Text editing/read-only. Live manager preparation also verified after moving extensions out of args. |
| Web features | 47 | Original Feed/upload scenarios plus content filtering, automatic/manual draft language, rich editing/document preview, required/disabled permissions, poll states, optional scores, slug constraints and route-status recovery. |
| REZICS Text | 10 | Workspace, new document, open/edit/save, open failure, save conflict, source mode and return to live preview, desktop/mobile preferences, Traditional Chinese dark theme. |
| About React islands | 10 | Desktop/mobile navigation, scroll unlock, language menu, persisted theme, Traditional Chinese/German layouts and three product stage labels. |

All unimplemented feature-specific permutations in the inventory remain explicit
candidates. Their runtime and provider workflow is configured; the inventory is
not a claim that every route, form or business state already has a dedicated story.

| Verification | Result |
| --- | --- |
| Owner integrity | Web, UI, Editor (including its story tsconfig), both Text packages, Text's Storybook config and the shared tooling package typechecks passed. About's Astro check reported zero errors, warnings or hints. |
| Official discovery | `stories find-by-component` mapped every one of the 27 files, including child-test IDs, with no missing paths. `stories changed` still returned an empty selection and was not trusted. |
| Component/a11y suites | Official attached runs passed Web 81/81, Text 10/10 and About 10/10. Each also passed the same number of accessibility checks without warnings or violations. |
| Deterministic behavior | About 22, Text app 37 and Editor 41 tests passed. The focused Web editor/Feed/fixture set passed 18 tests; the final entity-picker/slug/fixture subset passed 13 tests. |
| Native visual comparison | 32 new references were inspected. Non-update reruns passed Web 18 (including all six unchanged initial Button references), Text 10 and About 10: 38 comparisons in total. References are in each host's `.storybook/baselines/`; no custom image-diff implementation was introduced. |
| Screenshot inspection | Reviewed the native image sets and full-size rich document preview, entity empty/error states, dark native select, Text open/edit/save, source and live-preview modes, mobile preferences, mobile About menu and dark About header. |
| Static builds | All three Storybook builds passed. Web's large docgen program recycled near the default Node heap limit; a final Web build with a process-local 8 GiB heap completed successfully. Feature flags were retained. |
| Metadata | Official docs returned CodeMirror, Text app and About header prop contracts. The shared CodeMirror import resolves through its published package contract. Private About import hints are not an application export contract; use its colocated source import. |
| Review | Official reviews include all 101 entries across the three hosts. Thumbnail completion, group expansion, Web detail navigation and the actual editor interaction were inspected. Official Composition exposes both additional hosts from Web. |
| Runner isolation | A focused attached test passed after direct visual comparison, using separate native Vite optimizer caches. About's `--no-attach` suite also passed, qualifying the headless tool entry used by the new CI workflow. |
| SharkUI baseline | Audit still reports the existing `./ui/*` export and findings in 79 files. None overlaps this change's modified files; the upstream mirror has no diff. The check was not weakened. |

### Corrections found by rendered checks

- Added the missing React compiler-runtime subpath in the Next Vite adapter's
  dev and Vitest mappings via a small Yarn patch; retained the existing docgen
  TypeScript API patch.
- Kept native-i18n entry points in one optimized module graph, preserving the
  identity of symbol-based rich-text bindings.
- Split attached and direct browser-test caches and retained the early official
  Vitest project name, shared Vite configuration, typed screenshot injection and
  body/viewport handling from the initial integration.
- Preloaded lazy editor modules with native loaders and let renderer layout
  frames complete before the official embed freezer stops work. Normal Review
  thumbnails retain upstream initial-state semantics; detail views run interactions,
  and native test PNGs capture the final state.
- Moved CodeMirror extension objects out of serializable args. Editor stories use
  the official user-event setup with a 30 ms typing cadence so simulated input
  also works in the manager, where a zero-delay sequence lost characters.
- Made CodeMirror content keyboard-focusable, removed the unsupported menubar
  role from Text's navigation, and preserved discoverable inner landmarks without
  an outer application role.
- Made entity picker results genuinely conditional: no empty listbox is exposed;
  pending/empty/error messages are announced beside the input. Decorative avatar
  initials no longer pollute option names, and closed lists cannot retain an
  active-descendant reference to an unmounted option.
- Added a project-owned NativeSelect contrast correction outside the SharkUI
  mirror. About now supplies the existing readable brand-action role and a
  contrast-qualified warning tone. Identity/primary colors are unchanged.
- Prevented duplicate slug submission while pending, including Enter submission.
  Updated the stale About test expectation to the existing semantic foreground class.

### Review and operating boundaries

- [Web and shared libraries](http://localhost:6007/?path=/review/)
- [REZICS Text](http://localhost:6008/?path=/review/)
- [About](http://localhost:6009/?path=/review/)

These URLs require the corresponding local dev servers. A new server session may
need a new review from the official tool. Start Text and About before Web when
using Composition, so Storybook can classify them as public local references.

The dedicated advisory GitHub workflow is implemented with owner typechecks,
official component/a11y runs, static builds and native artifact retention; it has
not been executed on GitHub in this task. Windows visual references do not certify
Linux rendering. Full application E2E, Astro page rendering, real authentication,
database behavior, Tauri dialogs/native window handling, hosted Chromatic,
production capacity and deployment are outside this component acceptance.

The alpha manager still emits isolated-iframe source-identification and deprecated
manager-control diagnostics. Cold startup can emit a story-docs service readiness
warning. These do not establish a regression in component behavior: direct docs,
native tests and the inspected review navigation are separately verified. No
capability was disabled to hide these diagnostics.

Cross-host MCP aggregation also reports missing composed manifest endpoints on
this alpha, despite each host enabling component manifests. Composition navigation
and each host's direct official tools work; this acceptance does not claim a
single aggregated MCP source. Use the owning host's endpoint or CLI.

Cleanup of this task's `.temp` directory was rejected by automatic approval review
with `blocked by policy`, including a retry against the verified literal path.
The temporary artifacts remain. Durable references and acceptance records are in
their owning directories; no application data was reset or removed.

## Sources

- [CSF Next](https://storybook.js.org/docs/api/csf/csf-next)
- [Official Composition](https://storybook.js.org/docs/sharing/storybook-composition)
- Installed `storybook skills stories` and `storybook skills write-story`,
  and `storybook tools --help`, resolved version `11.0.0-alpha.0`.
