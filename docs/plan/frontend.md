# Frontend implementation and acceptance

Follow the [plan's scope and gates](README.md#acceptance-gates) and [execution timing](execution-workflow.md). Select shared Block/API contracts before dependent interfaces.

Apply the [product design principles](../architecture/product-design-principles.md)
across features. The API/UI skill supplies the relevant GUI or combined workflow;
feature contracts specify the actual controls and evidence, not a fixed layer count.

## Remaining experiences

- Identity and access: follow the [layered GUI contract](../architecture/identity-and-access-experience.md). Ordinary users enter a valid main Entity and complete reading/posting/joining/App connection without learning Principal, Binding or delegation internals. Collaboration controls provide named members/teams and role presets; dedicated advanced workspaces expose mixed recipients, multiple custom roles, scopes, representation, client/installation management and restricted diagnostics.
- Preserve advanced API-created configuration through ordinary edits, explicit identity selection across drafts/tabs and materially complete consent. The approximately 90% ordinary-user audience is a design priority, not measured success or permission to discard advanced API capabilities. Qualify [UX01-UX08](../testing/identity-and-access.md#experience-acceptance) after backend acceptance under the authorized rendered/human-study workflow.

- Native Work/release: common creative identity across domains, domain-applicable fields, virtual/actual issuing and independent selected content. Book is the first authoring/consumption journey; music, audiovisual, visual, game/software and mixed-media states must preserve the same contract.
- Composition authoring: distinguish reference-only attachment from explicit structure import; expose source-version selection, destination scope, preview, progress, cancellation/retry and refresh conflicts without requiring users to edit operation IDs or cursors.
- AO3-derived authoring: original/source works, fandoms, characters, contextual relationships, warnings, co-creators and collections through native contracts.
- Wiki/Catalog: names/authority, evidence/conflicts, native structures, multi-cover galleries and representative selection; wiki corpora organized as one or more Collections, including separate mod/project Collections.
- Relationship Graph Block: configuration, subgraph, accessible list/table fallback, relation/evidence details, truncation and expansion.
- Ratings: implement [explicit context/observation/revision actions](../architecture/database/ratings.md#commands-and-interaction-contract), standing/daily/per-experience entry, latest/history switches, time distributions, truthful denominators/freshness and matching drill-down. Before submission, identify whether the user is correcting an evaluation, recording another under the same question or using a different context; preserve drafts and advanced API state. Qualify TEMPUI01-TEMPUI06.
- Events: implement [category/topic/referent and temporal editing](../architecture/database/event-time.md#lifecycle-and-interaction), occurrence-date filtering/sorting, exact/possible and actual/planned states, and bounded event markers alongside score charts. Qualify TEMPUI07-TEMPUI08 without implying causation or changing a rating context.
- Skill/Prompt/MCP Hub: catalog/version/package/parameter/capability views; execution only after its separate decisions and backend gate.
- Community: Realm grouping/membership/governance, Collection curation and Zone page/subsite infrastructure; compose Zones with one or more Collections for wiki subsites, preserving publication relationships, native content identity, notifications and theme controls. Member administration must consume roster cursors through empty filtered pages and render nullable native Entity presentation. Private merge reviews must supply explicit source/target read-grant selections and handle revocation/expiry. A superseded request requires a new proposal and fresh reviews; retry remains available only for actionable execution failures.

Follow [Realm, Collection and Zone composition](../architecture/realm-collection-zone.md). Dynamic Collection interfaces are optional and require their separately qualified backend; the current frontend gate requires ordinary Collection-based composition only.

Apply the [API/UI design skill](../../.agents/skills/api-ui-design/SKILL.md). Keep all permitted alternatives, repeated occurrences, local labels/order and cross-page selections inspectable. An import result marked staged, partial, conflicted or failed cannot be displayed as a completed publication. Preserve user input on recoverable failures. History and reading controls name the relevant selected version; word count, duration, unknown and inapplicable properties follow the [native Work contract](../architecture/database/native-work.md). Backend completion and search/statistic freshness are separate states.

Use existing feature ownership, @rezics/ui and typed locales. Apply [Storybook review](../../.agents/skills/storybook-ui-review/SKILL.md) and the [browser authorization boundary](../../AGENTS.md#data-and-verification-boundaries).

Keep stories with their actual render owner: shared UI/editor consumers in Web, isolated Text/About providers, server email in render tests. Do not restore automatic all-story capture, committed pixel baselines or a second screenshot scheduler. Add stateful interactions/accessibility, then exercise full user journeys through the qualified backend.
