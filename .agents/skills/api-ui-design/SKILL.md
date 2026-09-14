---
name: api-ui-design
description: Design or review REZICS capability/API contracts and GUI interactions. Use for semantic or information-organization changes, not routine edits.
---

# API and UI design

Apply the [product design principles](../../../docs/architecture/product-design-principles.md)
and current [task scope](../../../AGENTS.md#task-scope-and-evidence). This skill
supplies methods; feature owners retain decisions and acceptance evidence.

## Select the relevant path

| Task | Method |
| --- | --- |
| Capability/API design | Use the contract method below. Assess affected consumers, but do not require GUI design or implementation outside the task. |
| GUI design | Read [GUI design](references/gui-design.md). Use existing authorized contracts; propose needed contract changes explicitly. |
| Both | Apply both methods and connect each relevant capability to its user task and state transition. A small mapping can help; it is not a required report for every change. |

Select by the changed responsibility, not a keyword or the presence of a frontend
directory. Routine copy, style or internal edits use their owning checks without
reopening product/API design. Read only applicable references; reuse context already
read. Use [research and validation](../research-and-validation/SKILL.md) for material
uncertainty or a substantive new choice, retaining original alternatives.

## Capability and API contracts

Identify the intended users/clients, outcome and actual constraints. Read the
owning schemas, runtime validation, service policy and affected consumers to
establish current behavior; distinguish it from the proposed target. A shared
type's alternatives can exceed what one operation allows.

- Define logical identities, resources and domain operations. Choose a useful
  boundary rather than one endpoint per table, field or GUI control.
- Specify inputs, state transitions, observable outcomes and authorization,
  including invalid, stale, denied, partial and unavailable states where relevant.
  Preserve omitted/null/empty, units, ordering and collection semantics.
- Define pagination, selection scope, batch atomicity, idempotent retries and
  long-operation progress/cancellation where the capability needs them. Keep
  work bounded under the owning capacity policy.
- Keep private/internal data and policy behind the correct boundary. GUI, SDK,
  MCP and other adapters must not recreate independent business authorization.
- Check whether aggregation or orchestration reduces client work without
  hiding failure, crossing authority boundaries or creating oversized responses.
  Resource-oriented methods and explicit domain commands are both available.

Use concrete producer-to-consumer examples to examine the contract. In design-only
work, state unresolved choices and validation criteria. In implementation work,
update the affected contracts and authorized consumers together, use owning
generators. During the current program, the [execution workflow](../../../docs/plan/execution-workflow.md)
owns test/check timing; the plan owns dependency gates.

## Completion

Validate the changed meaning, not only matching field names. For example, a retry
must not duplicate an effect, a two-value selection must remain two values, and a
partial result must not become success. Use existing owner tests and verification
permissions proportionately. Report what was checked and what remains unverified;
contract integrity does not establish rendered or human-usability acceptance.
