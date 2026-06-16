# Parameterized batch job — ensure pg-boss queue database / 参数化批处理作业 — 确保 pg-boss 队列数据库就绪

variable "registry" {
  type    = string
  default = "ghcr.io/rezics"
}

job "migrate-job-ensure" {
  datacenters = ["dc1"]
  type        = "batch"

  parameterized {
    meta_required = ["version"]
  }

  group "migrate" {
    task "migrate" {
      driver = "docker"

      config {
        image   = "${var.registry}/rezics-job-runner-migrate:${NOMAD_META_version}"
        command = "bun"
        args    = ["run", "scripts/ensure-job-db.ts"]
      }

      template {
        data        = <<-EOT
{{ with nomadVar "rezics/job-runner" }}
JOB_DATABASE_URL={{ .JOB_DATABASE_URL }}
{{ end }}
EOT
        destination = "secrets/env.env"
        env         = true
      }

      resources {
        cpu    = 300
        memory = 384
      }
    }
  }
}
