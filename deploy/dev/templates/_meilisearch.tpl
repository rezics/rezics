[[ define "meilisearch" -]]
  group "meilisearch" {
    service {
      name     = "meilisearch"
      port     = "http"
      provider = "nomad"
    }

    network {
      port "http" {
        to           = 7700
        host_network = "loopback"
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
          source = "rezics-meilisearch"
          target = "/meili_data"
        }
      }

      env {
        MEILI_ENV        = "development"
        MEILI_MASTER_KEY = "[[ var "meili_master_key" . ]]"
        MEILI_NO_ANALYTICS = "true"
      }

      resources {
        cpu    = 500
        memory = 512
      }
    }
  }
[[- end ]]
