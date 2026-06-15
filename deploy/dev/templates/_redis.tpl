[[ define "redis" -]]
  group "redis" {
    service {
      name     = "redis"
      port     = "redis"
      provider = "nomad"
    }

    network {
      port "redis" {
        to           = 6379
        host_network = "loopback"
      }
    }

    task "redis" {
      driver = "docker"

      config {
        image           = "redis:7"
        network_mode    = "[[ var "network" . ]]"
        network_aliases = ["redis"]
        ports           = ["redis"]
      }

      resources {
        cpu    = 100
        memory = 128
      }
    }
  }
[[- end ]]
