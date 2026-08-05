variable "backup_image" {
  type = string
}

variable "postgres_image" {
  type = string
}

job "rezics-postgres-restore-drill" {
  namespace   = "rezics-infrastructure"
  datacenters = ["dc1"]
  type        = "batch"

  periodic {
    crons            = ["0 0 6 * * 0 *"]
    time_zone        = "UTC"
    prohibit_overlap = true
  }

  group "isolated-restore" {
    count = 1

    restart {
      attempts = 0
      mode     = "fail"
    }

    network {
      mode = "bridge"
    }

    ephemeral_disk {
      migrate = false
      size    = 204800
      sticky  = false
    }

    task "postgres" {
      driver = "docker"

      lifecycle {
        hook    = "prestart"
        sidecar = true
      }

      config {
        image      = var.postgres_image
        force_pull = true
        args = [
          "-c", "listen_addresses=0.0.0.0",
          "-c", "shared_preload_libraries=pg_stat_statements,pgroonga_wal_resource_manager,pgroonga_crash_safer",
          "-c", "pgroonga.enable_wal_resource_manager=on",
          "-c", "pgroonga.enable_crash_safe=on",
        ]
        volumes = ["local/postgres:/var/lib/postgresql"]
      }

      env {
        POSTGRES_DB       = "rezics_restore_drill"
        POSTGRES_USER     = "restore_drill"
        POSTGRES_PASSWORD = "restore-drill-allocation-only"
      }

      resources {
        cpu    = 3000
        memory = 8192
      }
    }

    task "restore" {
      driver = "docker"

      config {
        image      = var.backup_image
        force_pull = true
        command    = "/usr/local/bin/postgres-restore-drill"
      }

      env {
        RESTORE_DATABASE_URL = "postgres://restore_drill:restore-drill-allocation-only@127.0.0.1:5432/rezics_restore_drill?sslmode=disable"
        RESTORE_JOBS         = "2"
        RESTORE_STAGING_ROOT = "/alloc/data"
      }

      template {
        data = <<-EOH
        {{- with nomadVar "database/backup-reader" -}}
        {{- range .Tuples }}
        {{ .K }}={{ .V | toJSON }}
        {{- end }}
        {{- end }}
        EOH

        destination = "secrets/runtime.env"
        env         = true
        change_mode = "noop"
      }

      kill_signal  = "SIGTERM"
      kill_timeout = "2h"

      resources {
        cpu    = 3000
        memory = 8192
      }
    }
  }
}
