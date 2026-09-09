# @rezics/storybook

Private tooling shared by the Web, REZICS Text and About Storybook hosts. It owns
the common official feature flags, viewport definitions and native Vitest Browser
configuration/screenshot lifecycle. Each host owns its framework, Vite aliases,
production CSS, translations and story providers.

`createStorybookVitestConfig` retains the required early
`storybook:<absolute-config-directory>` project name for the official CLI. It
uses an unscaled Playwright viewport and typed `provide`/`inject` for explicit
capture of the document body including portals. Normal passing tests create no
screenshots. Storybook, Vitest and Playwright own test
selection, screenshots, traces and review; this package only connects
their configuration. It is never a production application dependency.

Artifacts are isolated by host under `.temp/storybook/` and are never committed.
There is no persistent pixel-baseline workflow. Aspire injects `STORYBOOK_URL`
so failure links point to the same resource as the task's MCP client or CLI.

See the [workflow](../../docs/architecture/storybook-workflow.md) for commands,
ownership and acceptance boundaries.
