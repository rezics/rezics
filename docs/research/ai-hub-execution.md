# Hub execution and hosting decisions

Catalog/package/Prompt/MCP metadata and controlled protocol tests are selected in [the Hub contract](../architecture/database/ai-hub.md). The following decisions affect an execution-enabled product and must be settled before its dependent schema/API is implemented. They do not block independent catalog work.

[Connected applications](../architecture/connected-apps.md) now selects external
clients accessing REZICS APIs/MCP, Entity connections, consent and installation
delegation. The questions below concern REZICS executing uploaded artifacts,
connecting outward to other services or hosting their runtimes. Reuse the selected
identity/authorization foundation; do not reopen it as an unspecified Hub feature.

| Question | Required decision and evidence |
| --- | --- |
| Execution responsibility | Does REZICS only distribute/reference artifacts, connect on behalf of users, execute workloads, or host persistent service instances? Separate capabilities if several are elected. |
| Endpoint ownership | Who controls an endpoint, verifies a publisher and approves capability changes? A source claim or reachable URL is insufficient. |
| Authorization and secrets | Apply the selected mixed-authority, consent and installation model; decide outbound credential custody, runtime secret injection and isolation for hosted execution. REZICS-audience tokens cannot be passed through to unrelated services. |
| Runtime isolation | Define executable package trust, filesystem/network access, resource budgets, cancellation and allowed external effects; test the chosen runtime rather than relying on metadata. |
| Session/run records | Decide which invocation/session inputs, outputs, tool results and traces persist, their audience/retention/erasure, and exact content/model/tool versions. |
| Distribution and installation | Decide coordinate/version/artifact integrity, dependency resolution, installations, updates and rollback of the new system's own runtime state. |
| Cost and quotas | Define admission, metering, retries, duplicate charging/effects and failure/uncertain outcomes if hosted resources are offered. |

Resolve with explicit product behavior, authoritative protocol/runtime evidence and a small reproducible experiment where needed. Record accepted identities, transitions, permissions and tests in architecture/testing; do not create placeholder execution tables just to imply progress. No requirement preserves a previous Hub wire or storage contract.
