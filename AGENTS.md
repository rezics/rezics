STUDY DEEPLY BEFORE ANYTHING, PROACTIVELY RESEARCH ONLINE TO ENSURE BEST PRACTICES.

# AI Agent Instructions

- Read [CONTRIBUTING.md](./CONTRIBUTING.md) before making changes.
- Put all agent-generated temporary artifacts under `.temp/`, including reports and any notes or checklists used to keep implementation aligned with an agreed plan. Remove artifacts created for the current task before finishing unless the user explicitly asks to retain them; never delete pre-existing or user-provided files.
- Treat v1.0.0 as the first supported compatibility baseline. Remove and do not restore pre-v1 routes, schema versions, migrations, adapters, compatibility aliases, or removal guards. REZICS uses Romantic Versioning (RomVer) after v1.0.0: versions are `PROJECT.MAJOR.MINOR`, the second segment is for significant or breaking product, public API, or persisted-contract changes, and the third segment is for smaller additions, fixes, and maintenance releases. A breaking release must still include an explicit migration or cutover plan; it does not require a PROJECT bump.

## Performance and scalability

- Treat performance and scalability as design requirements whenever changing database schemas, queries, indexes, persisted data flows, backend services, APIs, search or recommendation systems, queues, workers, caches, batching, or background jobs.
- Use 500,000,000 rows as the minimum capacity-planning baseline for every potentially corpus-scale relation or dataset, and also estimate behavior at 3,000,000,000 rows. Prefer designs whose work can be partitioned or horizontally scaled beyond that rather than designs with a fixed single-node, whole-corpus, or in-memory ceiling. A strictly bounded control or configuration dataset may use its proven bound, but the bound must be stated explicitly.
- Record the relevant workload assumptions and growth math before accepting a performance-sensitive design: cardinality and data distribution, read and write rates, access patterns, latency or throughput targets, query complexity, row and index storage, write amplification, memory and network costs, concurrency, skew or hot keys, backpressure, and maintenance and migration costs. Do not extrapolate results from toy-sized data without evidence that the plan remains valid at the target cardinalities.
- Keep request-path and recurring-work costs bounded with appropriate techniques such as selective indexes, keyset pagination, bounded fan-out and batches, incremental computation, partition pruning, caching, and backpressure. Avoid full-corpus scans or recomputation, deep offset pagination, N+1 access, unbounded queues, and loading corpus-scale data into one process unless a documented workload analysis proves them safe.
- Validate risky database work with representative data distributions and `EXPLAIN` or `EXPLAIN ANALYZE`, and benchmark performance-sensitive backend paths when practical. Capacity calculations do not require every local test environment to contain 500,000,000 physical rows, but the evidence must cover the 500,000,000-row baseline and the 3,000,000,000-row estimate.
- If a design cannot meet the baseline, document the limiting resource, expected failure mode, observable thresholds, and an explicit partitioning, sharding, archival, or cutover path, and obtain maintainer approval before treating the design as complete.

## Frontend verification

- Do not automatically perform AI-assisted browser, screenshot, visual, or design QA after frontend changes. This includes starting a frontend server solely for validation, controlling a browser, capturing or comparing rendered output, and assessing visual fidelity, responsive layout, or rendered interactions. Perform this validation only when the user explicitly requests it in the current task; otherwise, frontend acceptance belongs to the human maintainer.
- Before handing off a frontend change, run the affected frontend workspace's TypeScript check at minimum. TypeScript errors and equivalent deterministic code-integrity failures are not acceptable. Run narrower non-rendering checks when they directly cover changed logic, but report them only as code-integrity evidence, not as frontend acceptance.
- Do not remove, disable, or weaken deterministic repository checks or CI to implement this policy. They are code-integrity gates, not AI frontend acceptance.

## Project stack

- The main frontend uses React, Vinext, and Tailwind CSS; consume shared UI through `@rezics/ui`.
- SharkUI is the canonical UI system. Do not introduce or substitute another UI library.
- Treat `libraries/ui/src/ui` as the upstream SharkUI mirror; put project-owned shared components in `libraries/ui/src/custom`.

## Localization

- Put every user-visible frontend string in its owner's typed localization resources (`@rezics/i18n` for `apps/web`, and the locale content contract for `apps/about`). This includes visible copy, accessibility labels, placeholders, validation feedback, notifications, empty/loading states, and user-visible metadata; do not write these strings directly in components.
- Write each locale in natural, locally appropriate language. Do not leave source-language wording in another locale. If a product or domain term has no approved localized wording, ask the maintainer instead of retaining the foreign term or inventing a translation.
- Treat `zh-Hant` as region-neutral Traditional Chinese, using Taiwan terminology and orthography as the project's house style.
- Take invariant brands, protocols, formats, and technical identifiers only from [`libraries/i18n/src/verbatim-terms.ts`](./libraries/i18n/src/verbatim-terms.ts). Do not create another allowlist or duplicate their spellings in TypeScript locale resources; keep all other visible wording localized and run the i18n policy check when locale content changes.
- Take localized product and domain terminology only from the typed termbase under [`libraries/i18n/src/terminology`](./libraries/i18n/src/terminology). Keep complete messages in their owner locale resources, use the termbase's semantic slot that fits the sentence, and do not invent synonyms or duplicate approved forms in TypeScript locale resources. Generated terminology documents are read-only views, not additional sources of truth.

## Frontend architecture

- Treat `apps/web/app` as a framework adapter layer, not an implementation layer. Keep only App Router special files and narrowly scoped adapters that must run at the routing or request boundary there. A route entry may read and validate framework inputs such as `params`, `searchParams`, headers, and cookies; declare metadata or route configuration; invoke framework control flow such as `redirect` or `notFound`; compose required root providers and boundaries; and then delegate immediately to project-owned code.
- Put page and screen composition, application-shell UI, feature behavior, data access, client state and effects, and reusable components under the owning `apps/web/features/<capability>` module, or under an existing non-`app` infrastructure owner such as `lib` or `i18n`. App Router entries should import, re-export, or pass request-derived values into those owners; do not add ordinary implementation modules under `apps/web/app`.
- Follow [Web feature organization](./docs/architecture/web-feature-organization.md) when adding, growing, or moving code under `apps/web/features`. Keep cohesive features flat, introduce only the role directories justified by current responsibilities, and migrate existing features when touched rather than through repository-wide path churn. Use `apps/web/features/following` as the reference structure.

## Slug addressing

- Treat Unit IDs as immutable identities and scoped slugs as optional, human-facing addresses. Follow [Unit slug addressing](./docs/architecture/unit-slug-addressing.md) whenever changing Unit references, API resource responses, lookups, frontend routes, canonical URLs, redirects, or short-link mappings.
