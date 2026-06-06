# @rezics/history

The history service serves history read APIs. After the queued ingestion
cutover, `HistoryOutbox` delivery is owned by `@rezics/job-runner` through
`history.outbox.ingest` jobs.

The service does not run an in-process outbox poller. To pause or resume
history ingestion, operate the job-runner `history.ingest` worker.
