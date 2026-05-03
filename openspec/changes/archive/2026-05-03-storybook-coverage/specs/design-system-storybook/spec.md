## ADDED Requirements

### Requirement: Shared config ships the a11y addon

`@rezics/storybook-config` SHALL include `@storybook/addon-a11y@^10` in its `baseStorybookConfig.addons` array. Per-package `.storybook/main.ts` files SHALL inherit the addon list from the shared config without per-package opt-in. The addon SHALL run at warning severity — failures SHALL surface in the Storybook UI panel but SHALL NOT fail builds.

#### Scenario: Addon registered in shared config

- **WHEN** the exported `baseStorybookConfig.addons` from `@rezics/storybook-config` is inspected
- **THEN** it SHALL include the string `@storybook/addon-a11y`

#### Scenario: All five package previews surface the a11y panel

- **WHEN** any of `package/{ui,editor,folio,admin,app}/.storybook/` runs `bun run storybook`
- **THEN** the served Storybook UI SHALL expose an "Accessibility" panel for each story

#### Scenario: Builds tolerate a11y warnings

- **WHEN** `bun run storybook:build` is run at the root with stories that emit a11y warnings
- **THEN** the build SHALL complete with exit code 0
- **AND** the warnings SHALL be observable in the served Storybook

### Requirement: Shared config supports play-function interaction stories

`@rezics/storybook-config` SHALL ship configuration sufficient for stories to use Storybook 10's `play` function (interaction testing) without per-package addon installation. The shared `basePreviewParameters` (or equivalent) SHALL expose `actions: { argTypesRegex: "^on.*" }` so action arguments are auto-spied for play-function assertions.

#### Scenario: argTypes regex set

- **WHEN** the exported `basePreviewParameters` from `@rezics/storybook-config` is inspected
- **THEN** it SHALL include `actions.argTypesRegex` set to a value matching event handlers (e.g. `"^on.*"`)

### Requirement: Per-cluster overview MDX docs register under `Domain/`

The `@rezics/app` Storybook SHALL provide six MDX overview docs under the `Domain/` doc tree, one per cluster: `Domain/Engagement`, `Domain/Cards`, `Domain/Posts`, `Domain/Shelves`, `Domain/Search`, `Domain/Profile`. Each MDX file SHALL live under `package/app/src/docs/`. Each SHALL embed at least one `<Story>` or `<Canvas>` from a story whose component is in that cluster, and SHALL cross-reference the abstraction-vs-split rule under `Foundation/Patterns`.

#### Scenario: Six overview docs registered

- **WHEN** `bun -F @rezics/app run build-storybook` is run
- **THEN** the resulting `storybook-static/index.json` SHALL contain doc entries titled `Domain/Engagement`, `Domain/Cards`, `Domain/Posts`, `Domain/Shelves`, `Domain/Search`, `Domain/Profile`

#### Scenario: Overview docs embed live stories

- **WHEN** any of the six `Domain/<Cluster>` MDX files is parsed
- **THEN** it SHALL include at least one `<Story>` or `<Canvas>` block referencing a story registered in the same Storybook
- **AND** it SHALL link or reference `Foundation/Patterns` for the abstraction-vs-split rule
