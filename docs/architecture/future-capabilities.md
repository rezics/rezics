# Approved future capabilities

These outcomes have enough product meaning in Outline to remain in the
Progress graph, but they are not v1 completion dependencies and have no current
first-class deployable owner. Their dependencies express technical meaning,
not priority.

## Local-first authoring

Planning context:

- [Outline: Desktop](https://outline.rezics.com/doc/desktop-9wPFJAc7vI)
- [Outline: `.rezics` configuration](https://outline.rezics.com/doc/rezics-config-Bvz8dDgvcI)

```progress
id: desktop.local-first-authoring
status: open
goal: Let creators keep source files in a local version-controlled workspace and publish them through explicit Rezics mappings.
depends:
  - studio.content-workspace
  - developer.api-access
accept:
  - A versioned `.rezics` project document maps local files to Rezics Units, language versions, Posts, and content-structure nodes without storing credentials.
  - Pull, diff, validate, preview, publish, conflict, rename, deletion, and offline behavior preserve local ownership and remote history.
  - The desktop tool uses the public API and OAuth or scoped tokens and never depends on private database or storage access.
verify:
  - Run project-document, path safety, mapping, diff, conflict, credential, API contract, and publish integration tests on supported desktop platforms.
  - Complete a Git-tracked novel workflow through initial publish, local edit, remote edit conflict, rename, offline work, and recovery.
```

## Federation and specialized sites

Planning context:

- [Outline: decentralization](https://outline.rezics.com/doc/5y675lit5bd5yyw-QWNJ17TX0n)
- [Outline: different subsite modes](https://outline.rezics.com/doc/5lin5zcm5qih5byp55qe5a2q56uz-agbQcDaJrf)

```progress
id: federation.realm-subsites
status: open
goal: Let an independently operated site register a Realm and expose verifiable content discovery and rendering contracts.
depends:
  - realms.community-lifecycle
  - developer.api-access
  - search.live-discovery
accept:
  - Site, operator, Realm, endpoint, protocol version, supported kinds, public keys, trust state, and revocation have explicit identities.
  - Remote discovery, canonical identity, fetching, rendering, update, deletion, moderation, abuse handling, and indexing do not grant the subsite authority over unrelated Rezics content.
  - Authentication, signatures, replay protection, request limits, SSRF defense, failure isolation, observability, and de-federation are enforced.
verify:
  - Run protocol, signature, replay, discovery, identity, moderation, SSRF, rate-limit, cache, revocation, and compatibility tests.
  - Federate a test Realm, publish and update remote content, lose the remote, revoke trust, and verify search and public-page recovery.
```

```progress
id: zones.memorial-community-template
status: open
goal: Offer a respectful daily memorial community template built from ordinary Realm, Zone, Post, calendar, anonymity, and moderation capabilities.
depends:
  - zones.composable-surfaces
  - realms.rules-and-moderation
accept:
  - Each day has a stable localized address and a bounded feed of memorial Posts under one explicit Realm and Zone policy.
  - Approved anonymity protects the public author identity while retaining abuse controls, lawful operator access, rate limits, and reporting.
  - Calendar navigation, content warnings, visual tone, accessibility, grief-safety guidance, moderation, and retention are reviewed for this use.
verify:
  - Run template, calendar, anonymous-publication, privacy, rate-limit, moderation, report, and accessibility tests.
  - Have qualified maintainers review representative posting, browsing, reporting, crisis-content, deletion, and disclosure journeys.
```

## Group messaging

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

## Dispatch

Planning context:

- [Outline: Dispatch v1 draft](https://outline.rezics.com/doc/dispatch-Nx6PWTVQPs)

```progress
id: automation.dispatch-hub
status: open
goal: Coordinate authorized project workers through a small, reliable task lifecycle and an auditable product control plane.
depends:
  - developer.api-access
  - observability.runtime-signals
accept:
  - The Hub owns projects, worker identity, allowed scope, query normalization, lane selection, receipts, result routing, audit, and dashboard meaning.
  - The Queue contract owns only enqueue, tag query, visibility, atomic claim, lease, heartbeat, acknowledgement, failure, retry, dead state, and reaping.
  - Duplicate delivery, worker crash, lease expiry, retry exhaustion, forged system tags, replayed receipt, failed result routing, cancellation, and recovery are safe and observable.
verify:
  - Run Queue backend conformance, Hub authorization, query, scheduler, receipt, result routing, audit, dashboard, concurrency, fault-injection, and recovery tests.
  - Execute one crawler task through enqueue, claim, heartbeat, API-token-attributed Rezics submission, completion, result routing, worker crash, retry, and dead-letter review.
```

## Public UI distribution

Planning context:

- [Outline: UI package](https://outline.rezics.com/doc/ui-gPNy8nuVN0)

```progress
id: developer.public-ui-package
status: open
goal: Publish a supported public Rezics UI package only after its SharkUI, styling, localization, and compatibility contracts are stable.
depends:
  - experience.shared-design-system
accept:
  - The public package exposes a deliberately small framework contract, peer dependencies, styles, configuration, accessibility guarantees, and tree-shakable entry points.
  - Private applications, services, generated code, and internal-only UI do not leak into the public dependency graph.
  - Versioning, changelog, migration, provenance, package signing, deprecation, examples, and consumer support follow the v1 compatibility baseline.
verify:
  - Run package boundary, API report, type, build, tree-shaking, style, accessibility, provenance, and representative external-consumer tests.
  - Install the packed artifact into clean supported consumers and verify setup, rendering, localization, upgrade, and removal.
```

## Creator insights

Planning context:

- [Outline: Studio tool](https://outline.rezics.com/doc/studio-1IyFIkqV8c)

```progress
id: studio.creator-insights
status: open
goal: Give creators trustworthy, privacy-bounded evidence about how their published work is discovered and opened.
depends:
  - studio.content-workspace
  - observability.runtime-signals
accept:
  - Impression, eligible view, click-through, unique audience, time window, content identity, locale, referrer class, and aggregation have explicit definitions.
  - Studio reports explain sampling, bot filtering, delayed data, retention, privacy thresholds, unavailable data, and corrections instead of implying false precision.
  - Collection is consent- and policy-aware, excludes sensitive identifiers from creator output, and cannot be used to infer a protected individual.
verify:
  - Run event-contract, attribution, deduplication, bot-filter, aggregation, authorization, privacy-threshold, retention, correction, and report tests.
  - Reconcile a controlled impression-and-click dataset with the creator report across locale, referrer, delayed-event, low-volume, and deleted-content cases.
```

## Tag contribution reputation

Planning context:

- [Outline: Tag contribution rewards](https://outline.rezics.com/doc/tag-iFeVJ0o4mB)

```progress
id: tags.contribution-reputation
status: open
goal: Recognize useful Tag discovery without turning classification disputes into opaque or irreversible account punishment.
depends:
  - tags.classification
  - realms.reputation-levels
accept:
  - Proposal, proposer, evidence, community evaluation, affected Realm, reputation effect, decision, expiry, reversal, and audit have explicit contracts.
  - Positive and negative effects use bounded, abuse-resistant rules with eligibility, quorum, anti-brigading, cooldown, and conflict-of-interest controls.
  - Contributors can understand, challenge, and correct a decision, and a corrected Tag restores all derived reputation effects.
verify:
  - Run proposal, voting, eligibility, quorum, abuse, reputation-calculation, expiry, reversal, appeal, authorization, and audit tests.
  - Exercise accepted, rejected, brigaded, conflicted, expired, corrected, and appealed Tag contributions with affected users and moderators.
```
