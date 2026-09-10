# M08: Skill, Prompt and MCP Hub

Dependencies: M01-M04. Owners: [Hub catalog](../../architecture/database/ai-hub.md), [Hub tests](../../testing/ai-hub.md), [open execution decisions](../../research/ai-hub-execution.md).

## Remaining work

- Qualify versioned Skill content/packages/files, Prompt parameters/examples, MCP software identity, distributions, endpoints and observed capabilities.
- Reuse native software/content/assets/relations/authority. Distinguish coordinates, releases, files, installations and runs.
- Test source-free authoring, imports, exact versions, dependencies, attribution, private resources, search and export.
- Use controllable fixtures for tools/resources/prompts, pagination, errors, capability changes and authorization; reachability alone is insufficient.
- Decide execution/hosting/session/secret policy before implementing those capabilities; independent catalog work can continue.

## Acceptance

Catalog behavior has deterministic native/API tests; untrusted package text remains data. Describing or downloading a Skill/service grants no execution authority. An execution-enabled Hub remains incomplete while its product/security contract is undecided.
