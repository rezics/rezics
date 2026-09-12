# Progress command authority

Every HTTP journal, completion, chapter-read and node-completion mutation enters
`withProgressWriteAuthority`. The boundary owns one transaction and requires the
current human Auth account with verified email, its active Self binding and matching authorization
revision. Selecting an organization does not transfer private Progress ownership.
Suspended/closed accounts and active bans/suspensions cannot write; silence permits
private Progress actions.

Lock order is Auth, Self, shared parent access fence, native parent row and the
account/parent journal advisory lock. The parent must currently be readable and
support Progress. A Self revision change already in flight prevents stale admission;
a change arriving after admission waits until the protected write commits.
Native catalog parents use catalog authority: a selected current `catalog.read`
(or `catalog.edit`) grant can disclose a private parent. Generic Unit grants do not
substitute for that native contract.

The parent read decision and account write enforcement are checked again after
all mutation work and waits. Grant expiry and scheduled bans can invalidate a
previously admitted operation without changing a locked row; rejection rolls back
journal entries, snapshots and trigger effects. Chapter/media parent edit checks
also run in the transaction. Independently protected content occurrences, manifest
mapping and child disclosure still belong to the creation/reading target; this
boundary is not their complete qualification.

The authority change adds fixed account/Self/native-parent point reads and one
account/target lock, with no new tables, rows, indexes or notification fan-out.
Different journals share authority read locks; the same account/parent serializes
writes. The configured statement timeout bounds individual waits. Monitor request
latency, lock waits and pool pressure: a large callback also extends its authority
lock lifetime.

Retain the 500,000,000-row baseline and 3,000,000,000-row estimate for Progress facts
and each amplified journal family. The broad `favorite_follow_progress` capacity
role is not a measurement of this physical layout. Current snapshot refreshes
aggregate a journal's live entries, and whole-journal deletion loads its entry IDs;
that work grows with journal size. Incremental statistics, bounded deletion,
exact-version references and skew/capacity qualification remain required in the
creation/reading and operations modules. These authority fixtures do not accept
unbounded journal work as a complete design.
