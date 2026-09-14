# AI agent instructions

Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing files.

## Task scope and evidence

- Apply the current request and existing authorization before skill defaults. Research/plan-only work is read-only; narrow tasks do not activate unrelated plan work. Continue independent authorized work while a material question is unresolved.
- For the current program, read the [active scope and phase](docs/plan/README.md#active-execution) and [execution workflow](docs/plan/execution-workflow.md). The workflow owns standing authorization and verification timing across repository rules and skills.
- For substantive decisions, use the research skill below; reuse applicable evidence rather than reopening settled choices.
- When changing agent behavior or adapting to a different model, consult current [official model guidance](https://developers.openai.com/api/docs/guides/latest-model) and assess representative tasks under the verification policy. Reuse guidance already read for the same decision; spelling, formatting and link-only edits do not trigger this research.
- If a rule blocks completion, identify its file and instruction, explain the conflict and report remaining work.
- Put task-created temporary files in `.temp/` and remove only those before finishing unless retention was requested. Durable deliverables belong in their owner; preserve pre-existing and user-provided files.

## Git commits

Follow [commit conventions](CONTRIBUTING.md#commits-and-verification) and the current program's [phase-specific policy](docs/plan/execution-workflow.md#progress-commits-and-completion).

## Data and verification boundaries

- Full-application browser, screenshot, visual, responsive and rendered-interaction QA, including starting an application server solely for it, requires the user's explicit request in the current task. Otherwise rendered acceptance belongs to the maintainer. This boundary also applies to skills.
- Frontend acceptance requires affected workspace TypeScript/deterministic checks. For visible UI, scoped Storybook browser tests and actual screenshot review are authorized and required through the [review skill](.agents/skills/storybook-ui-review/SKILL.md) at the applicable verification phase. Never report verified completion with unresolved integrity failures.
- For potentially corpus-scale data, retain the 500,000,000-row baseline and 3,000,000,000-row estimate. Read the capacity policy below when workload assumptions or costs change.

## Read when relevant

| Change | Owner and constraints |
| --- | --- |
| Substantive design, research or proposal evaluation | [Research and validation](.agents/skills/research-and-validation/SKILL.md). |
| Web routes, screens or feature organization | [Web feature organization](docs/architecture/web-feature-organization.md). Framework adapters stay in `apps/web/app`; implementation belongs to features or infrastructure owners. |
| Product capabilities, API contracts or GUI interaction design | [Product design principles](docs/architecture/product-design-principles.md) and [API/UI workflow](.agents/skills/api-ui-design/SKILL.md). |
| Shared UI or controls | [UI conventions](libraries/ui/README.md). Use `@rezics/ui` and SharkUI; do not add another UI library. Preserve the upstream `src/ui` mirror and put project components in `src/custom`. |
| Visible text or localization | [Localization](libraries/i18n/README.md) and [external content](.agents/skills/external-content-value/SKILL.md). Frontend strings use the owner's typed locale resources. |
| Resource slugs, canonical links or address redirects | [Slug addressing](docs/architecture/unit-slug-addressing.md). |
| Schema, queries, APIs, queues, workers, caches or persisted flows | [Capacity planning](docs/architecture/data-integrity-and-workload-budgets.md#capacity-planning) when costs or workloads change; [database conventions](CONTRIBUTING.md#database-and-catalog). |
| Permissions or grantability | [Access model](libraries/access/README.md). |
| Aspire topology, lifecycle or diagnostics | [Aspire skill](.agents/skills/aspire/SKILL.md). |
