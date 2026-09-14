# Product, API and GUI design principles

Status: adopted project principles. Apply when defining or reviewing product
capabilities, API contracts or interactions; routine edits do not require a new
design exercise. Feature contracts own their concrete decisions and acceptance.

## Contracts, defaults and hypotheses

Contracts are required outcomes within their stated scope, such as server-enforced
authorization and preserving saved state. Design defaults guide tradeoffs, such
as prioritizing common tasks. Hypotheses propose how to achieve those outcomes,
such as a particular screen layout. Evaluate them accordingly rather than treating
every suggestion as a universal rule. Apply current user instructions and real
constraints; record adopted changes in their owner without silently contradicting
another retained contract.

### 1. Start from the task

Define what people and integrating clients need to accomplish, what success means
and which constraints matter. Current tables, endpoints, screens and familiar
patterns are evidence, not the definition of the intended product. Consider
alternative workflows and original ideas when they better serve the outcome.
Label inferred audience needs and workload assumptions for validation.

### 2. Put reusable capabilities behind explicit contracts

API-centered design means GUI, SDK, MCP and other permitted clients share business
semantics and server-enforced policy. Define identity, operations, state transitions,
authorization and observable success/failure at their owning boundaries. Keep API
contracts understandable to integrators; complexity is justified by capability,
not by exposing every storage detail or internal operation.

An API is not a database dump. Resource-oriented interfaces can use domain commands
where ordinary CRUD is insufficient. Purpose-specific queries or orchestration
adapters can simplify client work while preserving authority and domain semantics.
Shared semantics do not require internal calls to make HTTP round trips or every
private operation to become public. Interaction sketches may refine the contract;
implementation still follows the existing [execution gates](../plan/README.md).

### 3. Make ordinary use direct and advanced use discoverable

Prioritize the maintainer's approximately 90% ordinary-user audience with useful
defaults and task-focused initial controls. That is a product priority, not a
measured population share, feature quota or achieved success rate. Offer advanced
capabilities through clear contextual entry points, not a schema-shaped initial
screen. Layers describe information and task organization; no fixed number of
levels, nested dialogs or mandatory wizard is prescribed.

Select initial controls from actual task needs. An advanced user should be able
to reach the relevant workspace directly. Choose layout, controls and grouping
from the task, available space and interaction cost; familiar patterns are options,
not restrictions on original solutions.

### 4. Preserve capability meaning across interfaces

Each relevant user-facing capability needs a discoverable, usable path for its
intended audience. This does not require GUI controls for every internal endpoint.
Presets and advanced controls configure the same underlying capability. Preserve
identity, cardinality, operators, ordering, scope, missing values and partial or
failed outcomes; do not reduce them merely to fit a control.

An ordinary edit must retain advanced configuration created through APIs. When a
surface cannot safely edit that state, show the relevant summary and route to a
capable editor rather than silently flattening it or discarding hidden values.
Backend/API and GUI can organize information differently while preserving meaning.

### 5. Keep material consequences visible

Show the identity, authority, affected scope and outcome when they matter to the
user's action. Consent, destructive consequences, relevant restrictions and privacy implications
cannot be hidden under advanced disclosure. Keep implementation/protocol detail in
developer or restricted diagnostic surfaces unless it helps the current user decide.
Preserve input on recoverable failures and provide a clear next action.

### 6. Validate both adopted patterns and original ideas

Use the [research and validation workflow](../../.agents/skills/research-and-validation/SKILL.md)
for substantive choices. Distinguish sourced findings, deductions and hypotheses.
Lack of an exact precedent does not disqualify an idea; popularity does not qualify
it. Check the claims that could change the decision using counterexamples,
contract/state tests, workload evidence or authorized use observations as appropriate.

Record results and remaining limits in the feature/test owner. API integrity tests
do not establish usability; screenshots do not establish representative human task
success. Revisit defaults when evidence shows ordinary tasks require unnecessary
advanced concepts. Existing verification/authorization boundaries remain in force.

## Ownership and application

[AGENTS.md](../../AGENTS.md) carries a short reminder and routing. The
[API/UI skill](../../.agents/skills/api-ui-design/SKILL.md) provides task-specific
methods; it does not duplicate this policy. [Shared UI](../../libraries/ui/README.md)
owns components and visual conventions, while [identity/access experience](identity-and-access-experience.md)
is one feature application. Keep source reasoning here and feature decisions with
their owners; do not create a new skill or permanent rule for every suggestion.

## Evidence and limits

Primary sources reviewed September 2026:

| Source | Selected lesson | Limit |
| --- | --- | --- |
| [Google AIP-121](https://google.aip.dev/121) | Model API resources/relationships independently of storage, with standard and appropriate custom methods. | Supports interface semantics; does not prescribe every REZICS transport or implementation order. |
| [Microsoft API design guidance](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design) | Model business capabilities and balance small chatty calls against oversized responses. | No automatic proof of this product's latency, workload or usability. |
| Nielsen, [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/), 2006 | Prioritize common controls and make advanced entry discoverable; evaluate the split through task analysis and observation. | Does not mandate three levels or establish the proposed ordinary-user proportion. |
| [Recognition and recall](https://www.nngroup.com/articles/recognition-and-recall/) | Keep relevant choices and context recognizable rather than requiring remembered technical details. | Does not choose the right controls or grouping for a specific task. |
| [OpenAI customization guidance](https://learn.chatgpt.com/docs/customization/overview) and [scoped instruction guidance](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra) | Persistent concise guidance plus selectively loaded workflows reduces irrelevant instruction load. | Validate actual routing and results; file structure alone does not prove behavior across models. |
