# Rezics history service — 历史记录服务

variable "version" {
  type    = string
  default = "dev"
}

variable "registry" {
  type    = string
  default = "ghcr.io/rezics"
}

job "rezics-history" {
  datacenters = ["dc1"]
  type        = "service"

  update {
    max_parallel    = 1
    health_check    = "checks"
    min_healthy_time = "15s"
    healthy_deadline = "3m"
    auto_revert     = true
  }

  group "history" {
    count = 1

    network {
      port "http" {
        static = 3004
        to     = 3004
      }
    }

    service {
      name     = "rezics-history"
      port     = "http"
      provider = "nomad"

      check {
        type     = "http"
        path     = "/health"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "history" {
      driver = "docker"

      config {
        image = "${var.registry}/rezics-history:${var.version}"
        ports = ["http"]
      }

      env {
        NODE_ENV                 = "production"
        OBSERVABILITY_LOG_FORMAT = "json"
        PORT                     = "3004"
      }

      template {
        data        = <<-EOT
{{ with nomadVar "rezics/history" }}
HISTORY_DATABASE_URL={{ .HISTORY_DATABASE_URL }}
SERVER_DATABASE_URL={{ .SERVER_DATABASE_URL }}
HISTORY_INTERNAL_SECRET={{ .HISTORY_INTERNAL_SECRET }}
{{ end }}
EOT
        destination = "secrets/env.env"
        env         = true
      }

      resources {
        cpu        = 200
        memory     = 256
        memory_max = 384
      }
    }
  }
}
