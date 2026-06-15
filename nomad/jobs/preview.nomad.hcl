# Rezics preview service — 预览服务

variable "version" {
  type    = string
  default = "dev"
}

variable "registry" {
  type    = string
  default = "ghcr.io/rezics"
}

job "rezics-preview" {
  datacenters = ["dc1"]
  type        = "service"

  update {
    max_parallel    = 1
    health_check    = "checks"
    min_healthy_time = "15s"
    healthy_deadline = "3m"
    auto_revert     = true
  }

  group "preview" {
    count = 1

    network {
      port "http" {
        static = 3007
        to     = 3007
      }
    }

    service {
      name     = "rezics-preview"
      port     = "http"
      provider = "nomad"

      check {
        type     = "http"
        path     = "/health"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "preview" {
      driver = "docker"

      config {
        image = "${var.registry}/rezics-preview:${var.version}"
        ports = ["http"]
      }

      env {
        NODE_ENV                   = "production"
        OBSERVABILITY_LOG_FORMAT   = "json"
        SERVER_PORT                = "3007"
        AUTH_INTERNAL_BASE_URL     = "http://127.0.0.1:3001"
        AUTH_PUBLIC_BASE_URL       = "https://auth.rezics.example"
        AUTH_PUBLIC_ISSUER_URL     = "https://auth.rezics.example"
        NOTIFY_BASE_URL            = "http://127.0.0.1:3002"
        REACTION_BASE_URL          = "http://127.0.0.1:3003"
        HISTORY_BASE_URL           = "http://127.0.0.1:3004"
        JOB_RUNNER_BASE_URL        = "http://127.0.0.1:3005"
        MEILI_HOST                 = "http://127.0.0.1:7700"
      }

      template {
        data        = <<-EOT
{{ with nomadVar "rezics/preview" }}
DATABASE_URL={{ .DATABASE_URL }}
AUTH_INTERNAL_TOKEN_GATEWAY_SECRET={{ .AUTH_INTERNAL_TOKEN_GATEWAY_SECRET }}
SMTP_HOST={{ .SMTP_HOST }}
SMTP_USER={{ .SMTP_USER }}
SMTP_PASSWORD={{ .SMTP_PASSWORD }}
TURNSTILE_SECRET={{ .TURNSTILE_SECRET }}
MEILI_MASTER_KEY={{ .MEILI_MASTER_KEY }}
NOTIFY_INTERNAL_SECRET={{ .NOTIFY_INTERNAL_SECRET }}
REACTION_INTERNAL_SECRET={{ .REACTION_INTERNAL_SECRET }}
JOB_RUNNER_INTERNAL_SECRET={{ .JOB_RUNNER_INTERNAL_SECRET }}
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
