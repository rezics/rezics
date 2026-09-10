# Skill, Prompt and MCP Hub acceptance

Owner: M08. Contracts: [Hub catalog](../architecture/database/ai-hub.md); [execution decisions](../research/ai-hub-execution.md) remain separate.

| Case | Required behavior |
| --- | --- |
| HUB01 | Create/read/revise/select Skill content and a package manifest through native identities. |
| HUB02 | Reject escaping/ambiguous package paths and missing files; preserve exact file/manifest digests. |
| HUB03 | Distinguish software identity, registry coordinate, version label, artifact, endpoint and installation. |
| HUB04 | Preserve declared dependency ranges and separately resolved dependency targets; detect unresolved/cyclic requirements under the elected policy. |
| HUB05 | Validate Prompt parameters/defaults/types and render exact template revisions with recorded examples. |
| HUB06 | Keep untrusted instruction-like content as data during ingestion, indexing and export. |
| HUB07 | Preserve authorship, licenses, derivation, source evidence and independent private/public selection. |
| HUB08 | Use a controllable MCP server to verify negotiated version and declared tool/resource/prompt capabilities. |
| HUB09 | Test lists, pagination, parameter schemas, resource reads and prompt retrieval with deterministic expected outputs. |
| HUB10 | Test invalid inputs, unavailable resources, protocol errors, timeouts and capability-change invalidation. |
| HUB11 | Keep credentials/private endpoint context out of public records, fixtures, logs and search. |
| HUB12 | Revoke authority during a controlled operation; stale descriptors or retries cannot grant new access. |
| HUB13 | Export/reimport selected catalog/package metadata without changing identity or executing code. |
| HUB14 | Confirm that catalog publication/download does not enable hosting, remote execution or elevated privileges. |
| HUB15 | Test native API/source update/withdrawal and exact-version selection with independent human overrides. |

Pin the elected [Agent Skills format](https://agentskills.io/specification) and MCP [tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools), [resources](https://modelcontextprotocol.io/specification/2025-11-25/server/resources) and [prompts](https://modelcontextprotocol.io/specification/2025-11-25/server/prompts) contracts. Live third-party endpoints are optional research/interop evidence, not a deterministic test dependency.

If hosted execution is elected later, add isolation, network/resource budgets, cancellation, secret lifecycle, delegated authority, metering, audit and recovery tests before claiming that capability. Catalog conformance does not establish executor safety or completeness.
