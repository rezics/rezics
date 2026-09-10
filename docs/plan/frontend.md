# Frontend after backend acceptance

Dependency: [G4](backend-acceptance.md). Define shared Block and API contracts earlier; implement interfaces after backend qualification.

## Remaining experiences

- Book/general creation: authoring, chapters/series, history, reading/progress, export, comments and private/public states.
- AO3-derived authoring: original/source works, fandoms, characters, contextual relationships, warnings, co-creators and collections through native contracts.
- Wiki/Catalog: names/authority, evidence/conflicts, native structures, multi-cover galleries and representative selection.
- Relationship Graph Block: configuration, subgraph, accessible list/table fallback, relation/evidence details, truncation and expansion.
- Skill/Prompt/MCP Hub: catalog/version/package/parameter/capability views; execution only after its separate decisions and backend gate.
- Community: Realm/Zone curation, navigation, memberships, governance, notifications and theme controls.

Use existing feature ownership, @rezics/ui and typed locales. Follow [Storybook workflow](../architecture/storybook-workflow.md) and affected TypeScript/deterministic checks. Inspect affected screenshots where authorized. Full-application QA remains a distinct activity under AGENTS.md, not a hidden requirement of documentation work.

Keep stories with their actual render owner: shared UI/editor consumers in Web, isolated Text/About providers, server email in render tests. Do not restore automatic all-story capture, committed pixel baselines or a second screenshot scheduler. Add stateful interactions/accessibility, then exercise full user journeys through the qualified backend.
