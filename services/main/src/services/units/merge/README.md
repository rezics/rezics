# Native merge qualification

Merge manifests read the native pair, participation/self bindings, existing
redirects and operation locks inside their transaction. Request snapshots batch
reviews, operations and rule references for the requested IDs. Queries sharing
that transaction client run sequentially; independent worker transactions may
still run concurrently.

The pair probes return at most two rows each. Request views retain two reviews,
one operation and at most 32 rule references per requested ID. The change adds
no queries, rows or indexes at the 500M baseline or 3B estimate. It removes
concurrent-client queuing without replacing bounded batch reads with per-item
application queries. This is not sustained-load qualification.

The [public reference fixture](../../../../../../docs/testing/foundation.md#public-reviewed-merge-reference-fixture)
creates real accounts and native public Publishing identities, obtains two
independent reviews, claims its own operation and executes canonicalization.
The database validates the redirect's reviewed pair and archive revision.
All of this runs in a rollback fixture and must emit no concurrent-client warning.

The fixture qualifies that public canonicalization slice. Private manifest
access, full reconciliation choices, revocation, restart and recovery remain in
the broader merge program; creating a redirect does not prove those later phases.
