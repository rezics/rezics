# Rezics notification service — 通知服务

variable "version" {
  type    = string
  default = "dev"
}

variable "registry" {
  type    = string
  default = "ghcr.io/rezics"
}

job "rezics-notify" {
  datacenters = ["dc1"]
  type        = "service"

  update {
    max_parallel    = 1
    health_check    = "checks"
    min_healthy_time = "15s"
    healthy_deadline = "3m"
    auto_revert     = true
  }

  group "notify" {
    count = 1

    network {
      port "http" {
        static = 3002
        to     = 3002
      }
    }

    service {
      name     = "rezics-notify"
      port     = "http"
      provider = "nomad"

      check {
        type     = "http"
        path     = "/health"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "notify" {
      driver = "docker"

      config {
        image = "${var.registry}/rezics-notify:${var.version}"
        ports = ["http"]
      }

      env {
        NODE_ENV                 = "production"
        OBSERVABILITY_LOG_FORMAT = "json"
        PORT                     = "3002"
        SERVER_JWKS_URL          = "http://127.0.0.1:3000/.well-known/jwks.json"
        SERVER_ISSUER            = "rezics-server"
      }

      template {
        data        = <<-EOT
{{ with nomadVar "rezics/notify" }}
NOTIFY_DATABASE_URL={{ .NOTIFY_DATABASE_URL }}
NOTIFY_INTERNAL_SECRET={{ .NOTIFY_INTERNAL_SECRET }}
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
