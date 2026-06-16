[[ define "redis" -]]
  group "redis" {
    service {
      name     = "redis"
      port     = "redis"
      provider = "nomad"

      check {
        type     = "tcp"
        port     = "redis"
        interval = "10s"
        timeout  = "2s"
      }
    }

    network {
      port "redis" {
        to = 6379
      }
    }

    task "redis" {
      driver = "docker"

      config {
        image           = "redis:7"
        network_mode    = "[[ var "network" . ]]"
        network_aliases = ["redis"]
        ports           = ["redis"]
        args            = ["--maxmemory", "256mb", "--maxmemory-policy", "allkeys-lru"]

        mount {
          type   = "volume"
          source = "rezics-prod-redis"
          target = "/data"
        }
      }

      resources {
        cpu    = 200
        memory = 384
      }
    }
  }
[[- end ]]
