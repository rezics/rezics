variable "sequin_postgres_image" {
  type    = string
  default = "postgres:18.4-trixie@sha256:3a82e1f56c8f0f5616a11103ac3d47e632c3938698946a7ad26da0df1334744a"
}

job "rezics-sequin-postgres" {
  namespace   = "rezics-infrastructure"
  datacenters = ["dc1"]
  type        = "service"

  group "postgres" {
    count = 1

    update {
      max_parallel      = 1
      health_check      = "checks"
      min_healthy_time  = "10s"
      healthy_deadline  = "15m"
      progress_deadline = "20m"
      auto_revert       = true
    }

    restart {
      attempts = 10
      interval = "30m"
      delay    = "15s"
      mode     = "delay"
    }

    network {
      mode = "host"

      port "postgres" {
        static       = 5433
        host_network = "loopback"
      }
    }

    volume "postgres" {
      type      = "host"
      source    = "rezics-sequin-postgres"
      read_only = false
    }

    task "postgres" {
      driver = "docker"

      config {
        image        = var.sequin_postgres_image
        force_pull   = true
        network_mode = "host"
        ports        = ["postgres"]
        args = [
          "-c", "listen_addresses=127.0.0.1",
          "-c", "port=5433",
          "-c", "password_encryption=scram-sha-256",
        ]
      }

      env {
        PGDATA        = "/var/lib/postgresql/18/docker"
        POSTGRES_DB   = "sequin"
        POSTGRES_USER = "sequin"
      }

      template {
        data = <<-EOH
        {{- with nomadVar "nomad/jobs/rezics-sequin-postgres/postgres/postgres" -}}
        {{- range .Tuples }}
        {{ .K }}={{ .V | toJSON }}
        {{- end }}
        {{- end }}
        EOH

        destination = "secrets/runtime.env"
        env         = true
        change_mode = "restart"
      }

      volume_mount {
        volume      = "postgres"
        destination = "/var/lib/postgresql"
        read_only   = false
      }

      service {
        provider     = "nomad"
        name         = "rezics-sequin-postgres"
        port         = "postgres"
        address_mode = "host"

        check {
          name     = "sequin-postgres-tcp"
          type     = "tcp"
          interval = "10s"
          timeout  = "2s"
        }
      }

      kill_signal    = "SIGTERM"
      kill_timeout   = "60s"
      shutdown_delay = "5s"

      resources {
        cpu    = 500
        memory = 1024
      }
    }
  }
}
