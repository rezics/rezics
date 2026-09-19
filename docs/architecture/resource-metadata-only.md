# Resource metadata-only presentation policy

Status: selected target. This policy controls an admitted hosting/presentation
capability; it is not a Resource classification, ownership type or license finding.

## Meaning and authority

A metadata-only Resource can expose permitted descriptive metadata without offering
hosted work content through this platform. A Work, external publication, indexed
video and encoded representation have distinct identities: indexing one does not
create a hosted copy or authorize presenting another's body. Preview media, excerpts
and full work content need explicit policy categories; a thumbnail does not silently
disable the full-content restriction.

Source intake defaults to descriptive indexing unless a separately authorized
hosting operation admits content. A native creation operation declares its own
presentation default and admission checks. Personal/community ownership or selecting
an Agent cannot prove hosting rights, availability or consent. Do not derive a
permissive default solely from the owner's identity type.

Changing this state is an independently grantable operation plus ordinary Resource
update authority. Repeating the stored value does not create a new policy change.
Restoration rechecks current authority, selected content, payload availability and
disclosure. Neither a stored license claim nor a past revision bypasses that check.
OperationContract declares admitted grantees; current permission strings and earlier
subject restrictions are implementation details in the
[access vocabulary](../../libraries/access/README.md), not a new public user layer.

## Storage and queries

Keep the policy with the owner that admits hosted-content presentation and bind it
to the actual Resource/selection scope. A typed boolean can encode a genuinely binary
policy; unavailable, erased, permission-denied and metadata-only are distinct states
in the wider model. Do not allocate a field on every object merely because all objects
share ResourceRef, or duplicate the policy in generic assertions and subtype columns.

Read the policy with the concrete owner/content selection under current access.
A Zone route reuses the same check; placement never grants body access. Search and
previews consume a named derived policy projection with a freshness/disclosure
contract. Withdrawing hosting does not delete independent source descriptions.

## Capacity and acceptance

Apply the 500M/3B baseline to each growing policy/selection relation. If a boolean is
stored on N already-required owner rows, its logical payload is N bytes before row
alignment; a separate policy row also incurs identity, revision, FK and index costs.
Sparse capability coverage and historical churn are independent multipliers. A
standalone boolean index usually does not serve a selective query; justify any
partial or composite index using the actual predicate and distribution.

Owner-local point reads, bounded policy changes and indexed inverse maintenance
stay in one database. Measure changed-row WAL, hot-owner lock waits, index growth,
projection lag and recovery. Qualify explicit creation defaults, denied policy
changes, metadata/body distinction, multi-Space rendering, restoration and erasure.
The former pre-1.0 blanket column-default cutover is not a current installation
instruction; preserve the completed baseline and use owning forward migrations.
