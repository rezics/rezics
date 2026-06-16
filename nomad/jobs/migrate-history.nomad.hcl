# Parameterized batch job — run history database migrations / 参数化批处理作业 — 执行 history 数据库迁移

variable "registry" {
  type    = string
  default = "ghcr.io/rezics"
}

job "migrate-history" {
  datacenters = ["dc1"]
  type        = "batch"

  parameterized {
    meta_required = ["version"]
  }

  group "migrate" {
    task "migrate" {
      driver = "docker"

      config {
        image   = "${var.registry}/rezics-history-migrate:${NOMAD_META_version}"
        command = "bun"
        args    = ["drizzle-kit", "migrate"]
      }

      template {
        data        = <<-EOT
{{ with nomadVar "rezics/history" }}
HISTORY_DATABASE_URL={{ .HISTORY_DATABASE_URL }}
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
