# Parameterized batch job — run reaction database migrations / 参数化批处理作业 — 执行 reaction 数据库迁移

variable "registry" {
  type    = string
  default = "ghcr.io/rezics"
}

job "migrate-reaction" {
  datacenters = ["dc1"]
  type        = "batch"

  parameterized {
    meta_required = ["version"]
  }

  group "migrate" {
    task "migrate" {
      driver = "docker"

      config {
        image   = "${var.registry}/rezics-reaction-migrate:${NOMAD_META_version}"
        command = "bun"
        args    = ["drizzle-kit", "migrate"]
      }

      template {
        data        = <<-EOT
{{ with nomadVar "rezics/reaction" }}
REACTION_DATABASE_URL={{ .REACTION_DATABASE_URL }}
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
