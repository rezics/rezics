# AI agent instructions

Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing files.

## Task scope and evidence

- Complete the requested outcome within its owner boundary. A research-only or plan-only request permits read-only investigation, not implementation.
- Apply the user's current instructions and existing authorization before skill defaults. Historical plans and approvals do not expand a new task. Continue independent authorized work while a material question is unresolved; do not ask again for approval already given.
- Inspect relevant code first. Research official sources when an API is unfamiliar, behavior is version-sensitive, or a design decision needs external evidence. Stop researching when the evidence supports the current decision.
- If a repository rule or skill blocks completion, identify the exact file and instruction, explain the concrete conflict, and report the remaining work.
- Put task-created temporary files in `.temp/`. Remove only those files before finishing unless retention was requested. Durable requested deliverables belong in their owning location; preserve pre-existing and user-provided files.

## Data and verification boundaries

- A fixture loader requiring a fresh database does not authorize resetting development data. Prefer an owning API or service for bounded content changes; follow the [fixture workflow](README.md#data-authority-and-showcase-fixtures) for interdependent changes. Before any reset, establish the exact target, authorization, scope and recovery consequence. Ask before deleting unrelated data when authorization is missing.
- For frontend changes, run the affected workspace's TypeScript check and relevant deterministic checks. Browser, screenshot, visual, responsive and rendered-interaction QA, including starting a frontend server solely for it, requires the user's explicit request in the current task. Otherwise rendered acceptance belongs to the maintainer. This boundary also applies to skills.
- Preserve deterministic checks and CI. Passing static checks is code-integrity evidence, not rendered, production or capacity acceptance.
- Do not hand off affected frontend code as complete with TypeScript or equivalent deterministic integrity failures.
- For potentially corpus-scale data, retain the 500,000,000-row baseline and 3,000,000,000-row estimate. Read the capacity policy below when the change affects workload assumptions or costs.

## Read when relevant

Follow only the owners relevant to the requested change:

| Change | Owner and constraints |
| --- | --- |
| Web routes, screens or feature organization | [Web feature organization](docs/architecture/web-feature-organization.md). `apps/web/app` contains framework boundary adapters; implementation belongs to features or existing infrastructure owners. |
| Shared UI or controls | [UI conventions](libraries/ui/README.md). Use `@rezics/ui` and SharkUI; do not introduce another UI library. Preserve `src/ui` as the upstream mirror; project components belong in `src/custom`. |
| Visible text or localization | [Localization](libraries/i18n/README.md). Every frontend string belongs to its owner's typed locale resources. For external content, use [external-content-value](.agents/skills/external-content-value/SKILL.md); optional copy must serve an audience need. |
| Identity, resource responses, URLs or redirects | [Slug addressing](docs/architecture/unit-slug-addressing.md). IDs are immutable identities; scoped slugs are optional addresses. |
| Schema, queries, APIs, queues, workers, caches or persisted flows | [Capacity planning](docs/architecture/data-integrity-and-workload-budgets.md#capacity-planning) when costs or workload assumptions change; [database conventions](CONTRIBUTING.md#database-and-catalog) for schema and catalog changes. |
| Permissions or grantability | [Access model](libraries/access/README.md); use the shared vocabulary and server-side enforcement. |
| Aspire topology, lifecycle or diagnostics | [Aspire skill](.agents/skills/aspire/SKILL.md). Ordinary application edits do not trigger it. |
| Operational-refactor continuation | [Current handoff](docs/plan/operational-refactor-20260906/NEXT_SESSION.md). Select a gap within the current request; earlier program mandates are historical scope. |
