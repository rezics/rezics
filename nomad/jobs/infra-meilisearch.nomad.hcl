# Meilisearch v1.45.0 — full-text search engine
# Meilisearch v1.45.0 — 全文搜索引擎

job "infra-meilisearch" {
  datacenters = ["dc1"]
  type        = "service"

  group "meilisearch" {
    count = 1

    network {
      port "http" {
        static = 7700
        to     = 7700
      }
    }

    volume "meilisearch-data" {
      type      = "host"
      source    = "meilisearch-data"
      read_only = false
    }

    service {
      name     = "meilisearch"
      port     = "http"
      provider = "nomad"

      check {
        type     = "http"
        path     = "/health"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "meilisearch" {
      driver = "docker"

      config {
        image = "getmeili/meilisearch:v1.45.0"
        ports = ["http"]
      }

      volume_mount {
        volume      = "meilisearch-data"
        destination = "/meili_data"
        read_only   = false
      }

      env {
        MEILI_ENV          = "production"
        MEILI_NO_ANALYTICS = "true"
      }

      template {
        data        = <<-EOT
{{ with nomadVar "rezics/infra" }}
MEILI_MASTER_KEY={{ .MEILI_MASTER_KEY }}
{{ end }}
EOT
        destination = "secrets/env.env"
        env         = true
      }

      resources {
        cpu        = 500
        memory     = 512
        memory_max = 768
      }
    }
  }
}
