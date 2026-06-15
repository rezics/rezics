job "rezics-prod" {
  type = "service"

  // ── Infrastructure ────────────────────────────────────────
  [[ template "postgres" . ]]
  [[ template "meilisearch" . ]]
  [[ template "redis" . ]]
  [[ template "rustfs" . ]]
  [[ template "sequin" . ]]

  // ── Backend services ──────────────────────────────────────
  [[ template "server" . ]]
  [[ template "auth" . ]]
  [[ template "notify" . ]]
  [[ template "reaction" . ]]
  [[ template "history" . ]]
  [[ template "ranking" . ]]
  [[ template "preview" . ]]

  // ── Workers ───────────────────────────────────────────────
  [[ template "workers" . ]]
}
