# Rezics ranking service — 排名服务

variable "version" {
  type    = string
  default = "dev"
}

variable "registry" {
  type    = string
  default = "ghcr.io/rezics"
}

job "rezics-ranking" {
  datacenters = ["dc1"]
  type        = "service"

  update {
    max_parallel    = 1
    health_check    = "checks"
    min_healthy_time = "15s"
    healthy_deadline = "3m"
    auto_revert     = true
  }

  group "ranking" {
    count = 1

    network {
      port "http" {
        static = 3006
        to     = 3006
      }
    }

    service {
      name     = "rezics-ranking"
      port     = "http"
      provider = "nomad"

      check {
        name     = "health"
        type     = "http"
        path     = "/health"
        interval = "10s"
        timeout  = "2s"
      }

      check {
        name     = "readiness"
        type     = "http"
        path     = "/ranking/ready"
        interval = "15s"
        timeout  = "3s"
      }
    }

    task "ranking" {
      driver = "docker"

      config {
        image = "${var.registry}/rezics-ranking:${var.version}"
        ports = ["http"]
      }

      env {
        NODE_ENV                 = "production"
        OBSERVABILITY_LOG_FORMAT = "json"
        PORT                     = "3006"
        REACTION_BASE_URL        = "http://127.0.0.1:3003"
        MEILI_HOST               = "http://127.0.0.1:7700"
      }

      template {
        data        = <<-EOT
{{ with nomadVar "rezics/ranking" }}
RANKING_DATABASE_URL={{ .RANKING_DATABASE_URL }}
SERVER_DATABASE_URL={{ .SERVER_DATABASE_URL }}
REACTION_INTERNAL_SECRET={{ .REACTION_INTERNAL_SECRET }}
MEILI_MASTER_KEY={{ .MEILI_MASTER_KEY }}
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
