# Local showcase fixture loader

This directory reads the content-pack file format used by the sibling
`rezics-showcase-packs` repository. It is local development infrastructure,
not a production ingestion service.

REZICS canonical rows and their REZICS-owned revision, governance, and audit
history are the sole source of truth. The loader does not persist a pack
ledger or parallel evidence tables, does not synchronize later pack changes,
and must never run against staging or production. Its service entry point
enforces a local database URL.

Load fixtures only into a freshly reset local database. A mixture of existing
and missing fixture Units is rejected; reset and reload instead of reconciling
the fixture repository with canonical data through this loader. This is a
loader invariant, not a general instruction to reset unrelated local state for
every bounded content edit. When only one existing product-owned resource must
be replaced, use its owning authenticated API, service operation, or a reviewed
loopback-only maintenance command and verify the exact persisted value. Keep
reset-and-reload for identity-graph, relation, slug, structure, or other
interdependent pack changes, or when no safe targeted write path exists.

The default bundle is a strictly bounded developer dataset (currently about
2,000 Units and 7,000 relation records, roughly 17 MB). Production capacity
planning at 500 million and 3 billion corpus rows therefore assigns this
loader zero rows and zero request-path work: it is intentionally not a
corpus-scale production data flow.

`light-novel-demo.ts` is the same class of local installer. After the
light-novel pack is loaded, `task local:light-novel-demo` uploads an optional
ignored banner through the Image Assets storage contract and installs one
approved Custom Theme revision on that Zone. It authenticates as Bootstrap
Profiles inside the process, never over HTTP, and is gated by
`assertLocalDatabaseUrl`. It is not a substitute for the public Custom Theme
review APIs outside a disposable local database.
