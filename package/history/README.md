# @rezics/history

The history service serves history read APIs. After the queued ingestion
cutover, `HistoryOutbox` delivery is owned by `@rezics/job-runner` through
`history.outbox.ingest` jobs.

The in-process polling consumer is disabled by default. Operators may enable
the temporary fallback poller with:

```bash
HISTORY_OUTBOX_POLLER_FALLBACK=1
```

Do not run `HISTORY_OUTBOX_POLLER_FALLBACK=1` while the job-runner
`history.ingest` worker is also active for the same main database outbox rows.
