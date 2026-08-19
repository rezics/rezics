# Unit metadata-only policy

Status: Accepted

Owner: Units

## Decision

Book, Media, and Software Units persist `metadataOnly` in their own subtype
tables. The field describes whether REZICS should present hosted work content;
it is independent from licenses and does not establish that any declaration
has legal effect.

Creation derives the default from ownership when the caller omits the field:
community-owned Units default to `true`, while profile-owned Units default to
`false`. The cutover sets every existing row to `true`. A caller may submit an
explicit value for either ownership mode.

Changing the persisted value requires both ordinary `unit.update` access and
the supplemental `unit.metadata-only.update` permission. Repeating the stored
value does not require the supplemental permission. The permission is
delegable to named subjects but cannot be granted to the broad
`authenticated` subject, and community creation does not grant it by default.
History restoration applies the same comparison and permission check.

## Capacity

At 500,000,000 rows and 3,000,000,000 rows across the three subtype tables,
the field adds one non-null boolean per contentful Unit plus row-alignment
overhead. It is read by primary-key subtype lookups and changed rarely. No
boolean index is created: its low cardinality would add write and storage cost
without supporting a selective request-path query. Any future corpus-wide
filtering must use an incrementally maintained search or analytics projection,
partitioned by Unit ID, rather than scanning these tables on a request path.

## Cutover

The migration adds each column as `NOT NULL DEFAULT true`, so PostgreSQL gives
all pre-existing Book, Media, and Software rows the required value in the same
schema cutover. New services then write the ownership-derived default
explicitly. No backward compatibility path is retained before v1.0.0.
