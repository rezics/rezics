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
the fixture repository with canonical data.

The default bundle is a strictly bounded developer dataset (currently about
2,000 Units and 7,000 relation records, roughly 17 MB). Production capacity
planning at 500 million and 3 billion corpus rows therefore assigns this
loader zero rows and zero request-path work: it is intentionally not a
corpus-scale production data flow.
