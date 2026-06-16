job "rezics-dev" {
  type = "service"

  [[ template "postgres" . ]]
  [[ template "meilisearch" . ]]
  [[ template "redis" . ]]
  [[ template "rustfs" . ]]
  [[ template "sequin" . ]]
  [[ template "app" . ]]
}
