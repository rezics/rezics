# Parameterized batch job — run notify database migrations / 参数化批处理作业 — 执行 notify 数据库迁移

variable "registry" {
  type    = string
  default = "ghcr.io/rezics"
}

job "migrate-notify" {
  datacenters = ["dc1"]
  type        = "batch"

  parameterized {
    meta_required = ["version"]
  }

  group "migrate" {
    task "migrate" {
      driver = "docker"

      config {
        image   = "${var.registry}/rezics-notify-migrate:${NOMAD_META_version}"
        command = "bun"
        args    = ["drizzle-kit", "migrate"]
      }

      template {
        data        = <<-EOT
{{ with nomadVar "rezics/notify" }}
NOTIFY_DATABASE_URL={{ .NOTIFY_DATABASE_URL }}
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
