# Rezics auth service — 认证服务

variable "version" {
  type    = string
  default = "dev"
}

variable "registry" {
  type    = string
  default = "ghcr.io/rezics"
}

job "rezics-auth" {
  datacenters = ["dc1"]
  type        = "service"

  update {
    max_parallel    = 1
    health_check    = "checks"
    min_healthy_time = "15s"
    healthy_deadline = "3m"
    auto_revert     = true
  }

  group "auth" {
    count = 1

    network {
      port "http" {
        static = 3001
        to     = 3001
      }
    }

    service {
      name     = "rezics-auth"
      port     = "http"
      provider = "nomad"

      check {
        type     = "http"
        path     = "/health"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "auth" {
      driver = "docker"

      config {
        image = "${var.registry}/rezics-auth:${var.version}"
        ports = ["http"]
      }

      env {
        NODE_ENV                 = "production"
        OBSERVABILITY_LOG_FORMAT = "json"
        PORT                     = "3001"
        BETTER_AUTH_URL          = "https://auth.rezics.example"
        AUTH_PUBLIC_BASE_URL     = "https://auth.rezics.example"
        AUTH_PUBLIC_ISSUER_URL   = "https://auth.rezics.example"
      }

      template {
        data        = <<-EOT
{{ with nomadVar "rezics/auth" }}
DATABASE_URL={{ .DATABASE_URL }}
BETTER_AUTH_SECRET={{ .BETTER_AUTH_SECRET }}
AUTH_INTERNAL_TOKEN_GATEWAY_SECRET={{ .AUTH_INTERNAL_TOKEN_GATEWAY_SECRET }}
SMTP_HOST={{ .SMTP_HOST }}
SMTP_USER={{ .SMTP_USER }}
SMTP_PASSWORD={{ .SMTP_PASSWORD }}
TURNSTILE_SECRET={{ .TURNSTILE_SECRET }}
{{ end }}
EOT
        destination = "secrets/env.env"
        env         = true
      }

      resources {
        cpu        = 300
        memory     = 384
        memory_max = 512
      }
    }
  }
}
