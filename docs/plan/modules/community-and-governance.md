# M06: community, participation and governance

Dependencies: M01-M03. Owners: dictionary D09-D13 and existing access, rule and communication contracts.

## Remaining work

- Qualify Realm community grouping/membership/rules, local selections and explicit publication relationships independently from Collection membership and Zone placement. Add member-revision preconditions and rule-backed moderation history; make departure acknowledgement cleanup bounded before scale acceptance.
- Complete [Collection-based wiki composition](../../architecture/realm-collection-zone.md) through Dock paths, target content/adopted-revision selection, public metadata/count policy and current-authority/history tests across Realm, Collection and Zone.
- Implement Thread topics/origins/response targets, closed states, staged topology and concurrent-leaf catch-up.
- Qualify reviews/scales, polls, tags/judgments, follow, collections, private favorites and progress with feature-specific actor uniqueness.
- Qualify shared Tag/favorite/follow/discussion behavior when content is imported, refreshed or independently published in multiple contexts. Do not duplicate votes, transfer child control or reveal private members through derived counts.
- Qualify conversations/history intervals, messages, recipient watermarks, delivery failures and private preferences/blocks.
- Preserve rule-backed decisions/reversals, ownership intervention, merge/split assignments, sensitive-field erasure and recovery. Complete merge/split backup/restore and whole-system recovery coverage.
- Retain exact-host/revision theme execution eligibility and emergency controls separately from content/skill metadata.

## Acceptance

Root removal preserves others' posts. Delegated personas cannot bypass voter uniqueness. Revocation, history and derived counts agree on visibility. Private communication/erasure survives replay without resurrection. Every public operation has adjacent denied-operation cases.

Azur Lane and Minecraft wiki scenarios support one or several Collections; a modding ecosystem supports separately maintained Collections and shared or separate Zone presentations. Collection membership, "published in" relationships, adopted revisions and page placement remain independently testable. Removing a presentation or grouping relationship preserves native content identities and other authorized uses.

## Optional extension

The [Dynamic Collection implementation guide](../../architecture/realm-collection-zone.md#optional-dynamic-collection-implementation-guide) is available for later activation. Its separate query identity, result semantics, permissions, budgets and recovery tests must be implemented together if activated. Dynamic Collection runtime work is not required by this refactor or its G4/G5 acceptance gates; ordinary Collections must not acquire ambiguous dynamic membership behavior.
