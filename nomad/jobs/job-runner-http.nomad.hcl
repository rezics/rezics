# Rezics job runner HTTP API — 任务运行器 HTTP 接口

variable "version" {
  type    = string
  default = "dev"
}

variable "registry" {
  type    = string
  default = "ghcr.io/rezics"
}

job "rezics-job-runner" {
  datacenters = ["dc1"]
  type        = "service"

  update {
    max_parallel    = 1
    health_check    = "checks"
    min_healthy_time = "15s"
    healthy_deadline = "3m"
    auto_revert     = true
  }

  group "job-runner" {
    count = 1

    network {
      port "http" {
        static = 3005
        to     = 3005
      }
    }

    service {
      name     = "rezics-job-runner"
      port     = "http"
      provider = "nomad"

      check {
        type     = "http"
        path     = "/ready"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "job-runner" {
      driver = "docker"

      config {
        image = "${var.registry}/rezics-job-runner:${var.version}"
        ports = ["http"]
      }

      env {
        NODE_ENV                 = "production"
        OBSERVABILITY_LOG_FORMAT = "json"
        JOB_RUNNER_ROLE          = "http"
        PORT                     = "3005"
        MEILI_HOST               = "http://127.0.0.1:7700"
        SEQUIN_HEALTH_URL        = "http://127.0.0.1:7376/health"
      }

      template {
        data        = <<-EOT
{{ with nomadVar "rezics/job-runner" }}
JOB_DATABASE_URL={{ .JOB_DATABASE_URL }}
SERVER_DATABASE_URL={{ .SERVER_DATABASE_URL }}
HISTORY_DATABASE_URL={{ .HISTORY_DATABASE_URL }}
MEILI_MASTER_KEY={{ .MEILI_MASTER_KEY }}
JOB_RUNNER_INTERNAL_SECRET={{ .JOB_RUNNER_INTERNAL_SECRET }}
SEQUIN_WEBHOOK_SECRET={{ .SEQUIN_WEBHOOK_SECRET }}
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
