job "rezics-prod" {
  type = "service"

  // ── Infrastructure ────────────────────────────────────────
  [[ template "postgres" . ]]
  [[ template "meilisearch" . ]]
  [[ template "redis" . ]]
  [[ template "rustfs" . ]]
  [[ template "sequin" . ]]

  // ── Backend service ───────────────────────────────────────
  [[ template "backend" . ]]

  // ── Workers ───────────────────────────────────────────────
  [[ template "workers" . ]]
}
