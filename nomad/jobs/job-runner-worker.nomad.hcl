# Rezics job runner worker (default lanes) — 任务运行器工作进程（默认通道）

variable "version" {
  type    = string
  default = "dev"
}

variable "registry" {
  type    = string
  default = "ghcr.io/rezics"
}

job "rezics-job-runner-worker" {
  datacenters = ["dc1"]
  type        = "service"

  update {
    max_parallel    = 1
    health_check    = "checks"
    min_healthy_time = "15s"
    healthy_deadline = "3m"
    auto_revert     = true
  }

  group "worker" {
    count = 1

    task "worker" {
      driver = "docker"

      config {
        image = "${var.registry}/rezics-job-runner:${var.version}"
      }

      env {
        NODE_ENV                 = "production"
        OBSERVABILITY_LOG_FORMAT = "json"
        JOB_RUNNER_ROLE          = "worker"
        JOB_WORKER_LANES         = "default"
        WORKERS                  = "2"
        MEILI_HOST               = "http://127.0.0.1:7700"
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
        cpu        = 300
        memory     = 384
        memory_max = 512
      }
    }
  }
}
