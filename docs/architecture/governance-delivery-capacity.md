# Governance notes and report delivery

Content review actions commit a durable referral-prefix delivery job in the same
transaction as the action. The request does not enumerate reporters. The active
owner set is at most one row, enforced by `unit_ownership_active_unit_key`.
Each worker transaction locks one job with `SKIP LOCKED`, reads at most 32
referrals by `(case_id, id)`, then commits the notifications, private notice read
receipts and cursor together. A crash rolls back that page. Notification dedupe
keys also identify the job and exact referral. Failures retain progress and retry
with a delay of 5 seconds up to 300 seconds; they never discard recipients.

Referral admission locks the case row for share. Closing actions lock it for
update. Referrals already admitted must finish before the action records its
boundary; admission against a closed case is rejected. Referral identity and
membership are immutable, and pending jobs prevent deletion of their evidence.
For an annotation on a still-active case, the captured UUID prefix defines its
recipient scope; later reports are handled by subsequent decisions.

Four independent shard probes run per worker tick. There are 64 shards, and each
shard has a database-enforced maximum of 4,096 total operational job rows,
including completed rows awaiting cleanup. Thus this control relation is bounded
at 262,144 rows. Admission takes a shard advisory lock and checks an indexed
prefix of at most 4,096 rows. A full shard rejects the whole action transaction;
the operator retries after delivery and cleanup free capacity. Completed jobs are
retained for 24 hours and deleted in batches of 128 every 10 seconds. The durable
action, report and delivered notification histories remain their owning records.

Recipient receipts are corpus-scale. They have the exact composite key
`(post_id, auth_user_id)`, 64 hash partitions on `post_id`, and an Auth-led index
for account erasure. Reads use one exact receipt lookup after restrictions and
current authentication; this grants only reading the specific public notice.
Notification preferences can suppress delivery but do not remove the recipient's
ability to read that notice. Receipts never populate the bounded generic Resource
ACL. Erasure removes at most 500 receipts per transaction using the composite
key, and receipt admission locks the current non-erased account, closing the
late-worker race. Account and routing identifiers are not exposed by the notice
or case-note response.

For capacity planning, assume 256 bytes per receipt including its two indexes,
alignment and moderate free space: 500 million receipts require approximately
128 GB, and 3 billion approximately 768 GB, before replication, backups, WAL and
bloat. The corresponding average partition sizes are 2 GB and 12 GB. Viral
notices concentrate writes in one partition, while many notices distribute
across partitions; additional worker instances can receive disjoint shard lists.
At one 32-row page per second, a single case with 500 million referrals needs
181 days and one with 3 billion needs 1,085 days. These extreme hot cases therefore
need a future partitioned recipient-range job plan before such a latency target
could be accepted. The present contract is durable eventual delivery, with no
promised completion SLA for a single enormous case. Across cases the fixed
four-page concurrency ceiling is 128 referrals per tick before controller fanout;
actual throughput is bounded by notification and mail-outbox writes. Increase
independent workers only with database throughput evidence. Monitor oldest
pending job age, per-shard occupancy, failure count, and page latency; alert before
75% occupancy or when the oldest ready job waits more than five minutes.

Case-note lists use immutable descending Post UUID cursors. A case list uses two
indexed binding candidates per case and hydrates only the newest note, returning
`notesNextCursor` for the remaining history. The note endpoint reads 20 notes by
default and at most 50, plus one cursor candidate; an exact note lookup reads only
that Post. At 500 million and 3 billion bindings these operations remain bounded
index seeks rather than history scans. Action subjects have one binding per each
of three note roles, enforced by a partial unique index; at most 100 action
subjects are hydrated in one service call.

These figures are planning estimates, not measured production capacity. Fresh
database fixtures must cover referral admission/closure races, page rollback and
retry, all-recipient delivery, private notice access, account erasure, admission
backpressure, note pagination, and representative `EXPLAIN` plans. PostgreSQL's
[locking SELECT documentation](https://www.postgresql.org/docs/current/sql-select.html)
describes the queue-specific use of `SKIP LOCKED`; ordinary content reads do not
use it to approximate a complete result.
