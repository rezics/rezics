# Pagination

The service currently uses opaque, runtime-validated keyset cursors for feeds,
messages, notifications, Studio, collections, ownership claims, and other
mutable result sets. This keeps continuation stable without making database
offsets a public contract.

The product has an unresolved request for numbered navigation that can jump
among an expanding set of pages. That request must not silently replace
cursor-based continuation with unbounded `limit`/`offset`: the decision needs
measured query behavior, mutation semantics, count cost, cache behavior, and an
explicit user journey. The originating question is recorded in the
[Rezics Outline pagination document](https://outline.rezics.com/doc/5yig6acb57o757wx-mnHd5ewoZa).

```progress
id: pagination.numbered-navigation-decision
status: open
goal: Decide and prove the bounded pagination contract for surfaces that require numbered navigation.
depends: []
accept:
  - The decision identifies the route families and user tasks that truly require page numbers instead of continuation.
  - Benchmarks compare the existing keyset path with bounded offset, seek-assisted, and materialized alternatives on representative production-scale distributions.
  - The chosen contract defines ordering, mutations between requests, total or estimated counts, maximum jump, invalid input, caching, and accessibility.
  - Existing cursor clients remain supported unless a SemVer-compatible migration and generated-client plan is approved.
  - The architecture document records the evidence, rejected alternatives, and rollout checks before implementation begins.
verify:
  - Reproduce the benchmark from a committed script or query plan against representative isolated data.
  - Review the decision with API, database, web, and accessibility owners.
  - Run pagination cursor tests and generated-contract checks after any approved implementation.
```
