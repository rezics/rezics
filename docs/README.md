# Documentation

The documentation has separate authorities for target design, current implementation,
executed evidence and operations. Read a document in that role: a target is not a
deployment claim, and an old passing fixture does not qualify a revised contract.

## Start here

1. [Architecture map](architecture/README.md): the selected model and domain owners.
2. [Native model](architecture/schema-modeling.md): Resource/Agent/Entity, typed
   values and relationships, exact references and the seven declarative contracts.
3. [Storage](architecture/database/resource-storage.md): physical fields and table
   families within one PostgreSQL database; concrete references and inverse reads.
4. [Space](architecture/space-composition.md) and [addresses](architecture/resource-addressing.md):
   shared community/presentation identity, typed router, UUID/scoped slug and reverse links.
5. [Standards adoption](architecture/standards-adoption.md): selected profiles,
   conditional formats, coverage/loss and evidence limits.

## Document roles

| Owner | Authority |
| --- | --- |
| [Architecture](architecture/README.md) | Target meaning, invariants, operation and workload contracts. |
| [Implementation reference](reference/README.md) | Current API/code/storage names and concrete implementation gaps. |
| [Plan](plan/README.md) and [workflow](plan/execution-workflow.md) | Active scope/phase, dependencies, acceptance gates and progress. |
| [Testing](testing/README.md) | Prospective cases, dated executed results, reproductions and open failures; these are separately labeled. |
| [Operations](operations/production-deployment.md) | Commands for the actual deployment, backup/recovery and incident response. |
| [Research](research/README.md) and [next-version proposals](next-version/README.md) | Unresolved or unselected directions, not active target obligations. |
| [Releases](releases/README.md) | Named-version behavior and historical cutovers. |
| [User agreement](legal/user-agreement.md) and [privacy policy](legal/privacy-policy.md) | Published legal text; architecture terminology edits do not alter legal obligations. |

## Implementation and verification

Use [current implementation contracts](reference/current-implementation.md) before
mapping target concepts to the checkout. Exact identifiers in commands, code blocks,
schema inventories and dated evidence remain implementation-spelled. They do not
create parallel semantic models. New runtime work follows its separately activated
scope; documentation completion does not pass product or capacity gates.

Documentation checks verify local links, role boundaries, terminology and required
ownership. Design checks reproduce inventory/dependency/capacity artifacts; they
must distinguish tracked authored sources from registered generated derivatives.
See [verification entry points](testing/README.md#execution-levels).

Maintainer prose is English. Keep each decision with its semantic owner and update
dependent contracts together. Replace obsolete target instructions rather than
append an overriding note. Preserve raw multilingual examples, operational commands,
upstream artifacts and dated evidence in their proper roles. Temporary research
attachments are inputs to review, not dependencies of maintained documentation.
