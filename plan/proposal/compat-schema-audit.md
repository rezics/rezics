---
title: Compatibility Schema Audit — Filling JSON Shape Gaps and Enforcing Additive Discipline
status: done
created: 2026-06-10
completed: 2026-06-10
supersededBy:
tags: [contract, schema, compat, convention, audit]
---

## Why

Additive-compatible JSON columns (`extra`, settings, metadata, and other plain
JSON columns) are deliberately not wrapped in envelopes. That strategy is only
safe if every column has a known contract shape and follows additive evolution
rules. Today many persisted JSON columns have no contract schema at all; the
only partial exception is `bookExtraSchema`, which currently contains a single
field.

This proposal finalizes additive-compatible JSON discipline, fills each column's
contract schema or exemption, and wires the mechanically checkable parts into
`check:convention`. It depends on `json-evolution-policy.md`, especially the
JSON column classification registry and the three-class model for persisted
JSON.

## Durable constraints & decisions

- Additive-compatible schemas are marked with `@compat additive-only` and must
  obey six rules: (comment -> shared envelope module JSDoc; each compat schema
  links back through JSDoc)
  1. Tolerant reader: read/parse schemas must not use
     `additionalProperties: false`. Strictness is reserved for write DTOs.
     This intentionally differs from the house style and is the core decision
     for compatible JSON.
  2. New fields must be optional and have documented defaults. Optional fields
     must never become required.
  3. Closed discriminated unions must include an unknown-kind fallback so old
     readers can degrade instead of crashing.
  4. Defaults are part of the contract and are immutable.
  5. Do not change field types or semantics, and do not reuse removed field
     names. Add a new field instead.
  6. Start with string enums instead of booleans; booleans become dead ends when
     a third state appears.
- Fill schemas from real usage first: inspect reads and writes before defining a
  schema. The schema documents current behavior; it must not invent fields. A
  truly unused column gets an open empty-object schema as a placeholder for
  future additive evolution. (comment -> schema JSDoc)
- Exemptions are limited to external standard formats and intentionally untyped
  generic KV: JWK in server/auth JWT tables, auth `OAuthClient.metadata`, and
  `EchoKV.value`. Internal arrays, bookkeeping JSON, and event payloads are not
  exempt. (type -> registry exemption list)
- `HistoryOutbox.payload` is additive-compatible JSON, not exempt JSON. It is a
  short-lived row, but it is still an internal protocol and needs a known shape:
  discriminated by event kind with an unknown-kind fallback. (type)
- Mechanically check only the reliable parts: compat read schemas cannot be
  strict, and discriminated unions need fallback branches. The other four rules
  remain review discipline. (comment -> rule code)

## Tasks

## 1. Finalize Discipline and Checks

- [x] 1.1 Put the six rules in
      `package/contract/src/envelope/envelope.ts` module JSDoc in bilingual
      form, and define the exact `@compat additive-only` marker format.
- [x] 1.2 Add convention checks under
      `tool/src/commands/convention/rules/`: schemas marked
      `@compat additive-only` must not use strict read-side
      `additionalProperties: false`, and discriminated unions need an
      unknown-kind fallback branch.

## 2. Fill JSON Column Schemas

For each column: inspect real reads and writes -> classify in the JSON column
registry -> define the contract schema or exemption -> add `@compat
additive-only` where applicable -> remove the temporary TODO entry.

- [x] 2.1 Identity and user profile:
      `User.description` (ContentDoc envelope), `User.permission`,
      `User.settings`, `User.extra`, and `ApiToken.scopes`
      (`db/schema/identity.ts`) -> contract user/auth modules.
- [x] 2.2 Shared unit state:
      `Unit.extra` and `Unit.aiDisclosureDetails`
      (`db/schema/unit.ts`) -> contract unit module.
- [x] 2.3 Catalog domains:
      `Book.extra` (expand existing `bookExtraSchema` and add `@compat`),
      `Game.extra`, `GameSystemRequirement.hardware`, `Media.extra`,
      `Series.extra`, `Shelf.extra`, `Link.extra`, and `SourceSite.refRules`.
- [x] 2.4 Social and discussion:
      `Post.extra`, `Realm.extra`, `UserUnitProgress.extra`,
      `UserUnitProgress.lastReadAnchor`, and `Comment.content`
      (ContentDoc envelope).
- [x] 2.5 Translation and content:
      `UnitTranslation.description` (ContentDoc envelope),
      `UnitTranslation.extra`, `ContentTranslation.content`
      (ContentDoc envelope), and `ContentTranslation.provenance`.
- [x] 2.6 Scoring:
      `ScoreAggregate.distribution`, `ScoreAggregate.fields`, and
      `ScoreEntry.fields`.
- [x] 2.7 Content structure:
      `ContentStructureAnchor.ancestorNodeIds/path/titlePath`. These are array
      columns stored as JSON and should be typed array schemas, not exemptions.
- [x] 2.8 Governance:
      `AccountEnforcement.metadata`, `ModerationCase.metadata`, and
      `StaffAuditLog.metadata`.
- [x] 2.9 Infrastructure:
      `HistoryOutbox.payload` as a kind-discriminated union with fallback;
      `EchoKV.value` as an explicit exemption with a reason comment.
- [x] 2.10 Exemptions:
      server and auth `Jwks.publicJwk/privateJwk`, auth
      `OAuthClient.metadata`, and `EchoKV.value` must be present in the JSON
      column registry with reasons and local comments.

## 3. Closeout

- [x] 3.1 Empty the temporary TODO bucket introduced by
      `json-evolution-policy.md` task 2.5; `task check:convention` passes.
- [x] 3.2 If schema filling finds fields that are written but never read, or
      read but never written, record that fact in the owning schema JSDoc or
      hand it to `task knip` / a later cleanup. Do not expand this proposal into
      deletion or behavior changes.

## Out of scope

- Enveloped JSON columns such as zone config and ContentDoc. They use upgrade
  chains, not additive-compatible discipline.
- Inventing new fields for compatible JSON columns or refactoring current usage.
  This proposal only documents existing behavior.
- Automation for compat rules 2, 4, 5, and 6; those stay under review
  discipline.
