# AI agent instructions

Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing files.

## Task scope and evidence

- Complete the requested outcome within its owner boundary. A research-only or plan-only request permits read-only investigation, not implementation.
- Apply the user's current instructions and existing authorization before skill defaults. Historical plans and approvals do not expand a new task. Continue independent authorized work while a material question is unresolved; do not ask again for approval already given.
- For substantive design and technical decisions, proactively study relevant primary research, standards and engineering implementations. Read the sources and assess their applicability to the task.
- Develop original alternatives. Distinguish sourced findings, inferences and hypotheses; evaluate both borrowed and original ideas against requirements, counterexamples and proportionate validation. State what remains unverified.
- Keep decision-relevant sources, versions/dates, tradeoffs and validation limits with the owning design. Reuse applicable evidence, resolve material gaps and contradictions, and stop when further investigation is unlikely to change the decision.
- When maintaining agent instructions or adapting to a different model, consult current [official model guidance](https://developers.openai.com/api/docs/guides/latest-model). Apply relevant changes and validate them on representative tasks.
- If a repository rule or skill blocks completion, identify the exact file and instruction, explain the concrete conflict, and report the remaining work.
- Put task-created temporary files in `.temp/`. Remove only those files before finishing unless retention was requested. Durable requested deliverables belong in their owning location; preserve pre-existing and user-provided files.
- Define reusable product capabilities through explicit API contracts with server-enforced policy. Design GUI around user tasks, useful defaults and discoverable advanced controls; preserve capability semantics and existing advanced state.

## Git commits

- Make each commit one coherent, buildable logical change. Include its
  required tests and consumers; split unrelated work.
- Review the staged diff. Commit only intended changes, and ensure the
  commit does not depend on uncommitted work.
- Follow `type(scope): summary`, with scope when useful. Describe the
  resulting change; explain non-obvious motivation in the body.
- The [current implementation plan](docs/plan/README.md) authorizes autonomous
  local commits after required checks, autonomous web research and full operation
  of its development/test environment. Apply that standing authorization without
  repeating permission requests for covered actions.

## Data and verification boundaries

- For the current implementation program, the maintainer authorizes full development/test environment control, including dependency/tool changes, downloads, service/container lifecycle, database resets and data regeneration. Identify the actual target and preserve unrelated user work. No old-schema/API/data/format compatibility constrains the program. Outside an authorized scope, a fixture's fresh-database requirement does not itself authorize deleting unrelated data.
- For frontend changes, run the affected workspace's TypeScript check and relevant deterministic checks. The [Storybook workflow](docs/architecture/storybook-workflow.md) authorizes scoped component browser tests, screenshots and reviews for story-covered UI changes. Full-application browser, screenshot, visual, responsive and rendered-interaction QA, including starting an application server solely for it, requires the user's explicit request in the current task. Otherwise rendered acceptance belongs to the maintainer. This boundary also applies to skills.
- For visible UI changes, use the [Storybook UI review skill](.agents/skills/storybook-ui-review/SKILL.md): inspect actual screenshots of the affected states and resolve scoped findings. Creating images or a Review is not evidence that the AI viewed them. Generated test images are not committed; pixel baselines and all-story capture are not default acceptance requirements.
- Preserve deterministic checks and CI. Passing static checks is code-integrity evidence, not rendered, production or capacity acceptance.
- Do not hand off affected frontend code as complete with TypeScript or equivalent deterministic integrity failures.
- For potentially corpus-scale data, retain the 500,000,000-row baseline and 3,000,000,000-row estimate. Read the capacity policy below when the change affects workload assumptions or costs.

## Read when relevant

Follow only the owners relevant to the requested change:

| Change | Owner and constraints |
| --- | --- |
| Substantive design, research or proposal evaluation | [Research and validation](.agents/skills/research-and-validation/SKILL.md). Study alternatives, assess evidence and validate the claims that matter to the decision. |
| Web routes, screens or feature organization | [Web feature organization](docs/architecture/web-feature-organization.md). `apps/web/app` contains framework boundary adapters; implementation belongs to features or existing infrastructure owners. |
| Product capabilities, API contracts or GUI interaction design | [Product design principles](docs/architecture/product-design-principles.md) and [API/UI workflow](.agents/skills/api-ui-design/SKILL.md). Select the API, GUI or combined path required by the task. |
| Shared UI or controls | [UI conventions](libraries/ui/README.md). Use `@rezics/ui` and SharkUI; do not introduce another UI library. Preserve `src/ui` as the upstream mirror; project components belong in `src/custom`. |
| Visible text or localization | [Localization](libraries/i18n/README.md). Every frontend string belongs to its owner's typed locale resources. For external content, use [external-content-value](.agents/skills/external-content-value/SKILL.md); optional copy must serve an audience need. |
| Resource slugs, canonical page links or address redirects | [Slug addressing](docs/architecture/unit-slug-addressing.md). IDs are immutable identities; scoped slugs are optional addresses. |
| Schema, queries, APIs, queues, workers, caches or persisted flows | [Capacity planning](docs/architecture/data-integrity-and-workload-budgets.md#capacity-planning) when costs or workload assumptions change; [database conventions](CONTRIBUTING.md#database-and-catalog) for schema and catalog changes. |
| Permissions or grantability | [Access model](libraries/access/README.md); use the shared vocabulary and server-side enforcement. |
| Aspire topology, lifecycle or diagnostics | [Aspire skill](.agents/skills/aspire/SKILL.md). Ordinary application edits do not trigger it. |
| Backend program execution | [Current plan](docs/plan/README.md). Follow shared design, module tests/persistence, APIs, combined backend acceptance and then frontend; update only the current progress authority. |
