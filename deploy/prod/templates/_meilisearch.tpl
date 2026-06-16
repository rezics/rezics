[[ define "meilisearch" -]]
  group "meilisearch" {
    service {
      name     = "meilisearch"
      port     = "http"
      provider = "nomad"

      check {
        type     = "http"
        port     = "http"
        path     = "/health"
        interval = "10s"
        timeout  = "2s"
      }
    }

    network {
      port "http" {
        to = 7700
      }
    }

    task "meilisearch" {
      driver = "docker"

      config {
        image           = "getmeili/meilisearch:v1.12"
        network_mode    = "[[ var "network" . ]]"
        network_aliases = ["meilisearch"]
        ports           = ["http"]

        mount {
          type   = "volume"
          source = "rezics-prod-meilisearch"
          target = "/meili_data"
        }
      }

      env {
        MEILI_ENV          = "production"
        MEILI_MASTER_KEY   = "[[ var "meili_master_key" . ]]"
        MEILI_NO_ANALYTICS = "true"
      }

      resources {
        cpu    = 500
        memory = 1024
      }
    }
  }
[[- end ]]
