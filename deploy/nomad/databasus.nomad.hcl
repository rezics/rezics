variable "databasus_image" {
  type = string
}

job "rezics-databasus" {
  namespace   = "rezics-infrastructure"
  datacenters = ["dc1"]
  type        = "service"

  group "databasus" {
    count = 1

    constraint {
      attribute = "${meta.role}"
      operator  = "="
      value     = "data"
    }

    update {
      max_parallel      = 1
      health_check      = "checks"
      min_healthy_time  = "15s"
      healthy_deadline  = "10m"
      progress_deadline = "15m"
      auto_revert       = true
    }

    restart {
      attempts = 10
      interval = "30m"
      delay    = "15s"
      mode     = "delay"
    }

    network {
      mode = "host"

      port "http" {
        static       = 4005
        host_network = "wireguard"
      }
    }

    volume "databasus" {
      type      = "host"
      source    = "rezics-databasus"
      read_only = false
    }

    task "databasus" {
      driver = "docker"

      config {
        image        = var.databasus_image
        force_pull   = true
        network_mode = "host"
        ports        = ["http"]
        volumes      = ["secrets/secret.key:/databasus-data/secret.key:ro"]
      }

      template {
        data = "{{ with nomadVar \"database/databasus-control\" }}{{ .DATABASUS_SECRET_KEY }}{{ end }}"

        destination = "secrets/secret.key"
        change_mode = "restart"
        perms       = "0400"
        uid         = 65532
        gid         = 65532
      }

      volume_mount {
        volume      = "databasus"
        destination = "/databasus-data"
        read_only   = false
      }

      service {
        provider     = "nomad"
        name         = "rezics-databasus"
        port         = "http"
        address_mode = "host"

        check {
          name     = "databasus-serving"
          type     = "http"
          path     = "/api/v1/system/version"
          interval = "30s"
          timeout  = "5s"
        }
      }

      kill_signal    = "SIGTERM"
      kill_timeout   = "5m"
      shutdown_delay = "5s"

      resources {
        cpu        = 2300
        memory     = 512
        memory_max = 2048
      }
    }
  }
}
