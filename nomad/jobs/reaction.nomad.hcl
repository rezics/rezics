# Rezics reaction service — 反应服务

variable "version" {
  type    = string
  default = "dev"
}

variable "registry" {
  type    = string
  default = "ghcr.io/rezics"
}

job "rezics-reaction" {
  datacenters = ["dc1"]
  type        = "service"

  update {
    max_parallel    = 1
    health_check    = "checks"
    min_healthy_time = "15s"
    healthy_deadline = "3m"
    auto_revert     = true
  }

  group "reaction" {
    count = 1

    network {
      port "http" {
        static = 3003
        to     = 3003
      }
    }

    service {
      name     = "rezics-reaction"
      port     = "http"
      provider = "nomad"

      check {
        type     = "http"
        path     = "/health"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "reaction" {
      driver = "docker"

      config {
        image = "${var.registry}/rezics-reaction:${var.version}"
        ports = ["http"]
      }

      env {
        NODE_ENV                 = "production"
        OBSERVABILITY_LOG_FORMAT = "json"
        PORT                     = "3003"
        SERVER_JWKS_URL          = "http://127.0.0.1:3000/.well-known/jwks.json"
        SERVER_ISSUER            = "rezics-server"
        REACTION_TYPES           = "upvote,downvote"
      }

      template {
        data        = <<-EOT
{{ with nomadVar "rezics/reaction" }}
REACTION_DATABASE_URL={{ .REACTION_DATABASE_URL }}
REACTION_INTERNAL_SECRET={{ .REACTION_INTERNAL_SECRET }}
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
