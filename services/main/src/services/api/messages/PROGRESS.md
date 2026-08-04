# Messaging Progress

Planning context:

- [Outline: instant-message Unit](https://outline.rezics.com/doc/unit-543pMo8Zu7)

```progress
id: messaging.group-conversations
status: open
goal: Let a Unit-backed group host consent-based real-time conversations with explicit membership and moderation.
depends:
  - messaging.direct-conversations
  - realms.community-lifecycle
accept:
  - Group identity, membership, roles, invitations, channels or threads, messages, mentions, read state, and lifecycle have one typed contract.
  - Delivery, ordering, reconnect, deduplication, history pagination, edits, deletion, blocking, reporting, and notification preferences are bounded and observable.
  - "`@all` or broad mention behavior requires explicit policy, permission, fan-out limits, and recipient preferences."
verify:
  - Run group identity, membership, authorization, delivery, ordering, reconnect, deduplication, mention, moderation, retention, and notification tests.
  - Exercise create, invite, join, leave, send, reconnect, broad mention, block, moderate, delete, and unauthorized-history cases.
```
