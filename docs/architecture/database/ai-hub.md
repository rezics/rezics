# Skill, Prompt and MCP Hub catalog contract

Selected Hub scope is native cataloging, versioned content/packages, discovery and controlled protocol conformance. [Execution questions](../../research/ai-hub-execution.md) must be decided before uploaded-package execution, outbound service connections or third-party runtime hosting is implemented. REZICS's own OAuth-authorized API/MCP access is separately selected in [connected applications](../connected-apps.md); it is not blocked on hosting an execution-enabled Hub. Use native software, Document, asset, relation, provenance and access mechanisms.

Independently maintained Skill, Prompt and software creations use the [common native Work definition](native-work.md); their package releases use the shared release/composition protocol with domain path, dependency and parameter constraints. Content identity, endpoint observation and runtime execution remain distinct. Importing a package's structure records exact local uses without executing it or importing credentials.

## Identity and versions

| Object | Meaning |
| --- | --- |
| Skill | Maintained instruction capability/content with versioned metadata and referenced files. |
| Prompt template | Document/template identity, exact revision, typed parameter contract, examples and intended context. |
| Package coordinate | Ecosystem/namespace/name address; distinct from software identity and release artifact. |
| Package release | Exact manifest/file digests and distribution identity; labels may move but exact artifacts do not. |
| MCP software/service | Indexed implementation/service identity and its descriptions/releases. |
| MCP endpoint | A deployment/location offering a protocol; not the software identity or an automatic trust grant. |
| Capability observation | Versioned observation of tools/resources/prompts under a specific endpoint/protocol/auth context. |

Skill directory/files follow the elected [Agent Skills specification](https://agentskills.io/specification). A package manifest fixes paths and file references and rejects escaping/ambiguous paths. Documenting dependencies differs from resolving a runnable environment. Prompt parameter schema, template revision and examples are independently versioned; injection-like text is preserved as content, never executed by the importer.

MCP [tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools), [resources](https://modelcontextprotocol.io/specification/2025-11-25/server/resources) and [prompts](https://modelcontextprotocol.io/specification/2025-11-25/server/prompts) have separate contracts. Pin the elected protocol version in observations/tests; endpoint availability or a description is not evidence of all capabilities. Capability changes invalidate cached descriptors without retargeting software/package identity.

## Authority and conformance

Publishing or downloading a package grants no execution capability. Credentials and private endpoint context stay outside public catalog metadata, fixtures, prompts and logs. Source descriptions are evidence; platform verification and current operational permission remain explicit.

The [Hub test specification](../../testing/ai-hub.md) uses a controllable fixture server for protocol behavior and native fixtures for version/parameter/package semantics. Executor/hosted-runtime gates are intentionally unresolved; that does not block the independent catalog tests.
