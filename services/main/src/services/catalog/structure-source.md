# Native structural source interpretations

Program and Publishing keep separate physical source-occurrence, baseline and
application-change families. This bridge covers the eight existing fixed native
structures. Ordered occurrences, publication coverage and installments continue to
use their own canonical owners; this is not a replacement universal component store.

Each immutable occurrence contains a canonical shape/fields value and the exact
set of observed fields. Unobserved fields are neutral defaults, never copied human
values. Its native history UUID is a separate record of the adopted state, which
may contain independent human overrides. Generated parent/type/method UUID columns
retain concrete owner and vocabulary-revision FKs even when the pure interpretation
differs from the currently adopted structure. Partial reverse indexes keep those
reference checks bounded. The canonical guard checks shape, field grammar,
observation neutrality, parent shape and vocabulary kind.

Ordinary updates read the exact preceding snapshot in the same root epoch, merge
only observed fields, preserve independent native fields, and reject competing
edits to a changed source field. A source field set cannot silently narrow.
Canonical Program/Publishing commands own invariant checks and immutable history;
the bridge never updates their tables directly. Applications require an initialized
fixed structure. Compensation checks the exact current child history UUID before
restoring the recorded before-history through its native command. A later change
to another component does not become authority to overwrite this one.

Application changes reference exact native histories. Their order uses immutable
`componentSequence`, not UUID chronology or a root's revision. Baselines retain
the original source occurrence and the current application-backed history. Both
recorded epochs are finalized during compensation; a rebind does not authorize
changes to its old native target. Source scope, native child identity and history
revision are checked separately.

## Capacity model

Plan independently for 500M source component occurrences and a 3B estimate in
each potentially growing physical family. Assume one current baseline and two
application-change rows per occurrence, a 512-byte average pure interpreted value,
100-byte source pointers, and one observed reference slot on common program rows.
Budget 1,200 bytes per occurrence including heap/primary/history/reverse indexes,
500 bytes per baseline and 320 bytes per journal change. This adds approximately
600 GB + 250 GB + 320 GB = 1.17 TB at 500M, or 7.02 TB at 3B before native history,
WAL, backups and page/TOAST distribution. Three copies with 30% reserve yield about
4.56 TB / 27.38 TB. These are planning allowances, not measured PostgreSQL sizes;
long publication pagination text requires measured byte distributions before bulk
admission and cannot use the 512-byte average as a worst-case claim.

The ordinary application bound is 128 distinct components and 1 MiB per immutable
interpretation. Snapshot reads are source/epoch/snapshot-prefixed and limited to
129 rows as an overflow check. At most two epochs and two snapshots per epoch are
read; after-history and baseline reads are batched, and baseline writes are bounded
upserts. No query walks component lifetime or scans the corpus. A 100-row native
read page remains the existing owner contract; source histories are editor-only.

Assume 100 source mutations/s and 1,000 native reads/s across owners. Each changed
component appends native history, a source occurrence, an application change and
a baseline update, plus its owner change event; plan for at least four persisted
records per component before secondary-index/WAL amplification. Current owner
revision locks serialize one hot object. At a 10 ms transaction, that object has
an upper bound near 100 serial writes/s; pause its worker when lock-wait p95 exceeds
100 ms or the bounded source queue fills. A 512-byte value at 100 mutations/s is
only 51.2 KiB/s of source-value payload; journal/index/WAL bytes must be measured
separately, especially for a skewed large owner.

Route immutable source occurrences, journals and current source baselines by
source record, keeping the full source key in every PK/FK. Native histories remain
owner-routed. The initial database preserves concrete cross-owner FKs; scaling
requires an explicitly reviewed owner/source placement and referential migration,
not a whole-corpus in-memory join or dropping integrity constraints. The parent
migration owner registers physical partitions and canonical guards. This design
does not certify 500M/3B throughput, physical shard capacity or recovery behavior.
