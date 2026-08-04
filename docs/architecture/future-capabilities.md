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
