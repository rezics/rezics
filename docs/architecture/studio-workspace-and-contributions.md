# Studio workspace and contribution history

Status: target contract. [Identity/access](identity-and-access.md),
[Resource references](database/README.md#34-resource-capabilities-across-owner-tables),
history and [disclosure](resource-landing-seo.md) own authority and identity.
Current projection identifiers and limitations are implementation reference, not
an alternative account-to-public-identity model.

## User outcomes

Your workspace lists Resources editable under the explicitly selected direct or
represented authority context. Your contributions lists attributable history for
the selected public Agent, subject to the requested public/private surface and
current disclosure. Historical contribution does not grant current edit access;
current edit access does not manufacture authorship.

Private recent visits, draft state and personal preferences belong to the private
account under their own policy. Switching Agent does not expose or transfer another
controller's private activity. Source imports do not turn an upstream creator or
the private ingestion operator into a native community contributor automatically.

## Model responsibilities

| Record/projection | Grain | Authority |
| --- | --- | --- |
| Direct workspace candidate | Selected typed authority subject, target ResourceRef and candidate path | Rebuildable discovery from ownership/RoleBindings; no stored permission verdict. |
| Recipient-set candidate | Declared Group/Realm member-set reference, target and binding | Shared candidate source; do not copy every membership into every target. |
| Contribution record/summary | Public Agent, exact attributed operation/content revision and target | History owns attributable effects; current disclosure is separately checked. |
| Recent visit | Private account and target reference | Personal state only; never authorization evidence or public contribution. |

Candidate and history rows do not independently own titles, bodies, visibility,
moderation or resource lifecycle. Native state/selected content supplies those
values through bounded owner hydration.

## Authorization and source selection

A request fixes authenticated Principal, selected authority subject, credential
ceiling, representation path where applicable, and explicit recipient-set context.
Direct Principal grants can seed a direct-Principal workspace. Agent or member-set
grants can seed the corresponding admitted context. Unrelated paths and identities
are not pooled to produce a larger union of rights.

Resolve candidate streams through the current IAM contract, including Group,
Realm membership, role/representation generations and assignment ceilings. Recheck
the resource-specific operation and disclosure on every returned target. A stale
projection can cause explicit missing/freshness behavior, but cannot allow an edit
or reveal private title/body metadata. Public Agent identity never implies a unique
private account or a usable representation path.

Source filters such as owned/direct/delegated describe the selected proof path,
not hard-coded public-profile versus Realm table names. De-duplicate the same
Resource across candidate streams with a stable documented precedence while
retaining explainable source information. A selected-source view does not silently
include unrelated direct rights.

## Bounded reads and cursors

Use keyset candidate windows, stable Resource tie-breakers, batched owner hydration
and explicit page/scan/fan-out/byte limits. Recipient sets and proof discovery have
IAM admission bounds; they are not recursively expanded without budget. Return
continuation through filtered-empty windows and distinguish exhausted, partial,
unavailable and stale states. Do not use a corpus count to decide whether more
results exist.

Cursors bind the normalized source/filter/order, selected authority context,
relevant policy/topology generations and stream frontiers. Revocation, Agent/context
switches or incompatible query changes require revalidation/new continuation.
Large dynamic recipient sets use their authoritative indexed membership/projection
contract rather than materializing a private account directory in the client.

Public contribution browsing checks the exact Agent attribution, current target
visibility and any history-specific disclosure. Account-private drafts/visits remain
separate. A historical contribution is retained after loss of edit permission where
its history remains visible; erasure and moderation follow their owning policies.

## Writes, projections and recovery

Owning commands commit canonical effects, exact history, idempotent receipt and
outbox atomically. Workspace/history projections process changes idempotently with
versioned checkpoints. Role, membership and representation changes affect proof
eligibility immediately; background candidate cleanup is not the revocation fence.
Rebuilds preserve attribution and cannot resurrect deleted or withdrawn state.

Keep candidate roots separate from high-volume contribution history and private
visits even when they share a query interface. Current storage adapters can use
specialized tables, but do not make their physical names part of Resource identity
or the logical source-selection contract.

## Workload and acceptance

Plan candidates, participation/history, visits and reverse bindings independently
at 500M/3B rows. Model assignments per subject, recipient-set fan-out, hot Agents,
stale/expired prefixes and row/payload sizes. Per-page work depends on admitted
candidate/stream budgets, not total corpus size. Use single-database indexes,
partitioning and bounded projections; machine/shard counts require separately
selected deployment evidence.

Qualify direct-Principal, represented-Agent and group/community paths; multi-controller
Agents; cross-context denial; contribution without current edit rights; private
visits; filtered-empty continuation; high-degree subjects; expiry/revocation during
pagination; and projection recovery. Earlier `Profile`/`Self` fixtures do not pass these
cases merely because a projected row was renamed.
