# Parameterized batch job — run auth database migrations / 参数化批处理作业 — 执行 auth 数据库迁移

variable "registry" {
  type    = string
  default = "ghcr.io/rezics"
}

job "migrate-auth" {
  datacenters = ["dc1"]
  type        = "batch"

  parameterized {
    meta_required = ["version"]
  }

  group "migrate" {
    task "migrate" {
      driver = "docker"

      config {
        image   = "${var.registry}/rezics-auth-migrate:${NOMAD_META_version}"
        command = "bun"
        args    = ["drizzle-kit", "migrate"]
      }

      template {
        data        = <<-EOT
{{ with nomadVar "rezics/auth" }}
DATABASE_URL={{ .DATABASE_URL }}
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
