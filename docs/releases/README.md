# Release records

The versioned files in this directory describe their named release and historical
cutover. Their terminology, binaries and SQL identifiers are evidence of that
version, not the current target architecture. Older destructive migration or rollback
steps must not be applied to a later installation baseline.

Use [production operations](../operations/production-deployment.md) for the current
deployment procedure, [the plan](../plan/README.md) for active work and
[architecture](../architecture/README.md) for selected contracts. Released SQL remains
append-only under [Contributing](../../CONTRIBUTING.md#versioning).
