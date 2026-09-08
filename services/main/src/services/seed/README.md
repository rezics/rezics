# Native development fixtures

The seed command runs only against an empty loopback database after platform installation.
It does not reset a database. Bootstrap accounts and reserved owner rows are excluded from
the empty-target probes; any other Auth account or concrete catalog/platform identity refuses
the run before fixture writes begin.

Fixture references are prepared in memory and then inserted into their actual owners. There
is no stored placeholder, universal Unit parent, or identity inferred from an arbitrary public
Entity. Human fixture accounts receive explicit Self bindings. Other catalog Entities remain
independent catalog records; an Auth operator is recorded separately when writing them.

Authored book content uses a native Publishing Text Version. Explicit synthetic Work and
Publication resources and coverage edges exercise the shared book model. Software revisions
use Software Versions, release membership uses Software Release components, and ordered
series membership uses Grouping relations and order profiles. System requirements use a
reviewed typed Catalog property. These replace the retired generic Variant, Release, Series,
and software-requirement rows.

Catalog titles and their changes use native Named Forms and immutable name revisions.
Rich fixture presentation remains in the shared localization capability attached by concrete
owner references. Platform content retains platform revision/restore examples. Favorites use
the Auth-owned service and history; ordinary private Collections have independent identities.

## Bounds and qualification

This is a one-time developer fixture workload, with zero production corpus rows or recurring
production work at both 500 million and 3 billion corpus rows. The current plan prepares fewer
than 10,000 identities; allocation refuses that ceiling. Primary fixture addresses depend on
owner and source key, independently of randomized Auth IDs and generated copy. The transaction
verifies that every prepared identity was materialized under its declared owner.

Empty-target admission performs at most one bounded existence probe per registered owner and
one Auth-account probe. Verification loads at most 10,001 IDs per owner and aborts as soon as
the total exceeds 10,000. It never materializes a production corpus in process memory.
Native commands retain their own batch, revision, reference, and byte budgets. Increasing
fixture bounds requires reviewing transaction time, generated relation counts, memory, and
test duration. This loader is not a production importer or production capacity qualification.
