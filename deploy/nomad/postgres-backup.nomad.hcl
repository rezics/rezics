variable "backup_image" {
  type = string
}

job "rezics-postgres-backup" {
  namespace   = "rezics-infrastructure"
  datacenters = ["dc1"]
  type        = "batch"

  periodic {
    crons            = ["0 30 2 * * * *"]
    time_zone        = "UTC"
    prohibit_overlap = true
  }

  group "backup" {
    count = 1

    restart {
      attempts = 1
      interval = "30m"
      delay    = "1m"
      mode     = "fail"
    }

    reschedule {
      attempts  = 1
      interval  = "2h"
      delay     = "5m"
      unlimited = false
    }

    network {
      mode = "host"
    }

    ephemeral_disk {
      migrate = false
      size    = 102400
      sticky  = false
    }

    task "logical-backup" {
      driver = "docker"

      config {
        image        = var.backup_image
        force_pull   = true
        network_mode = "host"
        command      = "/usr/local/bin/postgres-logical-backup"
      }

      env {
        BACKUP_JOBS         = "2"
        BACKUP_STAGING_ROOT = "/alloc/data"
      }

      template {
        data = <<-EOH
        {{- with nomadVar "database/backup-uploader" -}}
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
      kill_timeout = "30m"

      resources {
        cpu    = 2000
        memory = 4096
      }
    }
  }
}
