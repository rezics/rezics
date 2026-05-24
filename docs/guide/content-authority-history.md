# Content Authority, History, And Wiki Ownership

This note covers the operational parts of the v1 content-authority rollout.

## Infra Users

`rezics` and `rezics-wiki` are ordinary `User` rows with backing
`Unit(type=USER)` rows. They intentionally have no `authUserId`, so they cannot
be used as login identities.

Use `rezics` for official platform-owned content. Use `rezics-wiki` as the
custodian owner for community catalog/wiki content created through explicit
wiki-mode flows. Product UI may label `rezics-wiki` ownership as community
catalog ownership, but storage and permission code treats the value as a normal
User Unit id.

## History Consumption

Main canonical mutations write `HistoryOutbox` rows in the same database
transaction as the content change. Runtime delivery is owned by
`@rezics/job-runner`: Sequin observes committed `HistoryOutbox` inserts, the
runner enqueues `history.outbox.ingest`, and the worker persists the exact
stored outbox payload into the history database. Main writes do not call the
history service synchronously.

To pause history consumption, stop or scale down the job-runner
`history.ingest` worker. Main canonical writes continue and outbox rows remain
pending. When the worker resumes, it can process pending rows without a backfill
of main current state.

The legacy in-process history poller is disabled by default. During migration it
can be temporarily enabled with `HISTORY_OUTBOX_POLLER_FALLBACK=1`, but do not
run that poller and the job-runner history worker as concurrent owners of the
same outbox rows.

Failed rows are observable through admin dashboard counts. Admins can move
failed rows back to pending with:

```http
POST /admin/history-outbox/retry-failed
Content-Type: application/json

{}
```

Pass `{ "unitId": "<unit-id>" }` to retry failures for one Unit only.

## Backfill Policy

No automatic backfill is required for existing development rows. Wiki ownership
is forward-only in v1: new wiki-mode creation resolves `Unit.userId` to the
seeded `rezics-wiki` user on the server.

For manual review of existing wiki-shaped rows, run:

```bash
bun --filter=@rezics/server run scripts/list-wiki-shaped-rows.ts
```

Review the output before any one-off data repair. Do not bulk rewrite owners
without an explicit migration plan.

## API Consumer Notes

Wiki-capable create APIs accept `creationMode`.

- Send `creationMode: "wiki"` for community catalog/wiki creation.
- Send `creationMode: "personal"` or omit the field where the API defaults to
  personal ownership for personal work/claim flows.
- Do not send owner ids for wiki creation. The server ignores or rejects
  client-submitted owner identity and resolves `rezics-wiki` internally.

Runtime edit authority is separate from creation mode. Edits are admitted by
current owner, collaborators, endpoint policy, and `UnitFieldLock` rows.
