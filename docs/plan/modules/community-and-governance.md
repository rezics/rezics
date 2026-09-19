# M06: community, participation and governance

Dependencies: M01-M03. Owners: dictionary D09-D13 and existing access, rule and communication contracts.

## Remaining work

- Implement the selected [Space contract](../../architecture/space-composition.md) when this scope is activated: one identity owner, separate Realm/community and Zone/routing capability state, independent retirement/recovery, and presentation/publication/governance/canon context roles. Ordinary creation recommends separate linked community and presentation Spaces.
- Replace native ZonePage ownership with versioned route-to-Resource bindings and shared rendering. Update address, navigation, Block execution, SEO and retained consumers together; multi-Space reuse must not copy content, select drafts or confer authority. Qualify MODEL29-MODEL36 before claiming the new flow complete.

- Implement Org and Realm membership policies over the [shared identity/access model](../../architecture/identity-and-access.md), including Agent participation versus private operational membership, admission generations, all-members sets, multiple Groups/Teams and custom role bindings. Preserve mute/ban history independently from rejoin and do not infer Org-wide enrollment into a Realm.
- Qualify Agent-held and directly assigned administration, privileged group changes, role edits, constrained representation and private independent-approval/accountability rules through the [target cases](../../testing/identity-and-access.md). Scope App installation management through M01's shared protocol owner.

- Qualify Realm community grouping/membership/rules, local selections and explicit publication relationships independently from Collection membership and Zone placement. Add member-revision preconditions and rule-backed moderation history; make departure acknowledgement cleanup bounded before scale acceptance.
- Complete [Collection-based wiki composition](../../architecture/space-composition.md) through Dock paths, target content/adopted-revision selection, public metadata/count policy and current-authority/history tests across Realm, Collection and Zone.
- Implement Thread topics/origins/response targets, closed states, staged topology and concurrent-leaf catch-up.
- Implement the complete [rating context/history contract](../../architecture/database/ratings.md): standing, daily and per-experience observations, same-observation revisions, explicit context transitions, private counting identity, exact/live review citations and current disclosure. Qualify RATE01-RATE33 with M09; a standing-only histogram is not completion.
- Support latest-per-rater then equal-rater mean as the platform default, context-declared mean-per-rater defaults, explicitly labeled raw distributions and policy-preserving query/GUI state. Qualify [the rating and temporal experience cases](../../testing/ratings-and-event-time.md#experience-acceptance) after backend acceptance.
- Qualify polls, tags/judgments, follow, collections, private favorites and progress with feature-specific actor uniqueness.
- Qualify shared Tag/favorite/follow/discussion behavior when content is imported, refreshed or independently published in multiple contexts. Do not duplicate votes, transfer child control or reveal private members through derived counts.
- Qualify conversations/history intervals, messages, recipient watermarks, delivery failures and private preferences/blocks.
- Preserve rule-backed decisions/reversals, ownership intervention, merge/split assignments, sensitive-field erasure and recovery. Complete merge/split backup/restore and whole-system recovery coverage.
- Retain exact-host/revision theme execution eligibility and emergency controls separately from content/skill metadata.

## Acceptance

Root removal preserves others' posts. Delegated personas cannot bypass voter uniqueness. Revocation, history and derived counts agree on visibility. Private communication/erasure survives replay without resurrection. Every public operation has adjacent denied-operation cases.

Azur Lane and Minecraft wiki scenarios support one or several Collections; a modding ecosystem supports separately maintained Collections and shared or separate Zone presentations. Collection membership, "published in" relationships, adopted revisions and page placement remain independently testable. Removing a presentation or grouping relationship preserves native content identities and other authorized uses.

## Selected Subscribe follow-on

The selected [Subscribe and Realm policy application](subscriptions-and-pro.md)
adds reusable entitlement admission, action/resource meters and version-bound AI/human
review when M10 is activated. Keep those changes separate from the active native
membership scope. Its Pro Realm uses ordinary membership/rules and independent
publication contexts; general replies and activity do not inherit Pro acceptance
from a root. Qualify the affected governance/discussion consumers with M10's cases.
Use the [multi-context reply contract](../../architecture/realm-scoped-delivery.md#reply-identity-and-multiple-realm-acceptance)
for create/additional-publication paths, per-destination root/parent admission and
independent selected revisions. Root-only read checks and global reply statistics
do not qualify the destination's reply connections or metadata.

## Optional extension

The [Dynamic Collection implementation guide](../../architecture/space-composition.md#optional-dynamic-collection-implementation-guide) is available for later activation. Its separate query identity, result semantics, permissions, budgets and recovery tests must be implemented together if activated. Dynamic Collection runtime work is not required by this refactor or its G4/G5 acceptance gates; ordinary Collections must not acquire ambiguous dynamic membership behavior.
