# Storybook AI review and Aspire lifecycle

Status: Implemented and locally verified.

## Accepted objective

Use actual screenshots to help the AI identify problems in new and changed UI.
Do not make pixel regression, image counts or a permanent screenshot archive the
default workflow. Preserve the existing useful stories, interaction/a11y checks,
official next-channel capabilities and verified component fixes.

The maintainer authorized implementation, Aspire integration and a new commit.
Remove generated reference images from the current Git tree; preserve existing
history and product/fixture assets. This policy supersedes the earlier screenshot
operating requirements, without rewriting their historical acceptance records.

## Implementation

- Added the repository-owned `storybook-ui-review` skill and routed visible UI
  work to it through AGENTS.md. It requires actual image inspection and scoped
  fixes, while keeping full-application acceptance separate. Other repository
  skills and operating docs now follow the same boundary; plugin caches are untouched.
- Passing tests no longer take screenshots. Explicit `storybook:capture` commands
  require file selection and retain native browser capture. Failure screenshots
  and traces remain available. Removed pixel comparison configuration and tasks.
- The six previously tracked Button reference images are removed from Git's
  index. All `.storybook/baselines` directories are ignored, including the 32
  uncommitted images from the repository coverage work.
- Aspire's `storybook` mode registers only three JavaScript resources, with
  injected ports, HTTP/MCP/Review links and reference-driven Composition. Web waits
  for Text and About readiness. Normal development can opt in with
  `REZICS_ASPIRE_STORYBOOK=true`; the application smoke mode remains unchanged.
- Added a bounded Storybook-only smoke path to the existing lifecycle wrapper.
  It checks named resources, story indexes and MCP tools, then stops only its
  owned AppHost. It runs without database/application secret settings.
- Removed the committed fixed Codex MCP URL. Connect to the actual endpoint from
  Aspire; use the equivalent official CLI if a task cannot dynamically reconnect.
  No global Codex settings or user accounts are changed.
- CI keeps owner typechecks, interaction/a11y tests and static builds. Captures
  remain on-demand; generated pictures never enter the commit.
- The alpha offline tool bridge failed with `UniversalStoreFollowerTimeoutError`.
  Independent tasks/CI now use the official Vitest addon directly; connected MCP
  and CLI testing remain available on Aspire-managed hosts.

## Acceptance

- The isolated Aspire smoke passed: all three resources became Healthy, indexed
  106/11/12 stories respectively (Web/Text/About), exposed nine MCP tools each,
  and stopped cleanly without database configuration.
- Native interaction/accessibility suites passed all 101 tests: Web 81, Text 10,
  About 10. A before/after artifact inventory confirmed that the passing default
  suites created or changed no screenshots. One transient Playwright trace
  shutdown failure passed on a scoped and then complete rerun without disabling
  tracing.
- Explicit Brand capture passed and changed exactly one selected screenshot.
  The AI inspected that image and the actual Aspire-served Brand preview; both
  rendered correctly. Connected official CLI component/accessibility testing also
  passed against the Aspire-managed Web host.
- Web, UI, Editor, Text, About and AppHost typechecks passed. Immutable Yarn
  installation and skill frontmatter validation passed.
- This is scoped component/lifecycle acceptance. Full application rendering,
  production capacity and remote CI execution are not certified by these checks.

## Sources

- Installed Aspire 13.5.3 docs: `set-up-javascript-apps-in-the-apphost`,
  `typescript/aspire.hosting.javascript/addnodeapp`, and the restored TypeScript SDK.
- [Storybook MCP](https://storybook.js.org/docs/ai/mcp/overview)
- [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- Installed Storybook `skills` and `tools` help; the repository policy selects
  scope and evidence rather than adopting every generic workflow default.
