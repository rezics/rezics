# CDC Admin Repair

Status: in progress

## Context

- Sequin CDC now has at least two database sources:
  - `source`: server DB publication `rezics_sequin_pub_<env>` and slot `rezics_sequin_slot_<env>`.
  - `reaction`: reaction DB publication `rezics_reaction_sequin_pub_<env>` and slot `rezics_reaction_sequin_slot_<env>`.
- The existing `task service -- source verify/repair` only manages the server source. Reaction CDC can drift or be missing without a first-class repair path.
- The server status aggregator models CDC as one source and checks the combined routed table manifest against the server DB, which can hide the real owner of missing reaction CDC objects.
- Admin repair already supports bounded, auditable repairs, but it cannot represent CDC infrastructure findings.

## Durable Decisions

- CDC expected state is source-specific. Detection, UI, and CLI repair must report `source` and `reaction` independently.
- Browser/admin-triggered repair must stay bounded to application jobs. Dropping replication slots, terminating WAL sender backends, and recreating publications remain local service CLI operations.
- Admin may dry-run CDC issues and queue safe downstream recovery, primarily HistoryOutbox replay after CDC is healthy again.
- Missing reaction diagnostics must be explicit. If the server does not have a reaction DB diagnostic URL, the reaction CDC source reports `unknown` with remediation instead of being folded into server CDC drift.
- User-facing admin strings introduced or touched in the repair/status surfaces go through `@rezics/i18n`.

## Checklist

- [x] Add a multi-source CDC manifest and service CLI verify/repair command.
- [x] Keep legacy `source verify/repair` working while pointing operators to the broader CDC command.
- [x] Extend server status types and aggregation to return per-source CDC status and issue codes.
- [x] Add optional server env for reaction CDC diagnostics and per-source publication/slot overrides.
- [x] Add admin `cdc` repair scope dry-run support and safe start behavior.
- [x] Update status and repair admin UI to show per-source CDC, issue remediation, and i18n strings.
- [x] Cover the new behavior with focused tests.
