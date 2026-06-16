---
title: Seed Search Boundary Reset
status: done
created: 2026-06-16
completed: 2026-06-16
supersededBy:
tags: [seed, search, meili]
---

## Why

Search projection ownership is currently blurry: factory `init-and-sync` can
reset Meili, factory compensates for part of baseline seed, and baseline infra
data can exist in Postgres without matching Meili documents. The intended
boundary is stricter: destructive reset belongs to reset workflows; seed and
factory only ensure indexes exist and then project the data they create or
ensure.

The result should make baseline seed, factory seed, and reset independently
repeatable. Re-running seed after a Meili reset must repair baseline search
documents without depending on factory or a full sync.

## Durable constraints & decisions

- `(comment)` `ensureMeiliIndexes` is idempotent and must never delete
  documents; destructive behavior belongs to the reset helper.
- `(test)` `resetMeiliIndexes` deletes known indexes/documents and then ensures
  schema/settings, while seed/factory paths use only the non-destructive ensure.
- `(test)` baseline seed syncs its own users and infra Units after idempotent DB
  ensure, including already-existing infra rows.
- `(test)` factory seed no longer resets Meili in `init-and-sync`; it ensures
  indexes and syncs only its own prerequisites/synthetic data through the shared
  targeted sync hooks.
- `(type)` seed sync hooks cover the search target kinds baseline/factory can
  create directly: content, post, realm, zone, tag, label, user, entity, and
  content-contained-units.

## Tasks

## 1. Meili Init Boundary

- [x] 1.1 Split the seed Meili helper into non-destructive ensure and
  destructive reset functions.
- [x] 1.2 Update CLI/reset callers so reset owns destructive Meili cleanup.

## 2. Shared Targeted Sync

- [x] 2.1 Keep seed/factory targeted sync hooks as the common direct path to
  real `@rezics/search` sync functions.
- [x] 2.2 Make baseline seed able to use the same search runtime as factory.

## 3. Infra Projection Ownership

- [x] 3.1 Thread optional sync hooks through infra seed.
- [x] 3.2 Sync default realm, official zones, realm taxonomy tags/realms/posts,
  content/search tags, game/media taxonomy tags, and platform entities from the
  infra seeders.
- [x] 3.3 Ensure existing infra rows are also synced on rerun.

## 4. Validation

- [x] 4.1 Update focused tests for reset/ensure and baseline/factory sync
  behavior.
- [x] 4.2 Run focused Bun tests; skip full build and other long checks.

## Out of scope

This does not add a full search rebuild command or change runtime API mutation
job behavior.
