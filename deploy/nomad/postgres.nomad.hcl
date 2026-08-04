variable "postgres_image" {
  type = string
}

job "rezics-postgres" {
  namespace   = "rezics-infrastructure"
  datacenters = ["dc1"]
  type        = "service"

  group "postgres" {
    count = 1

    update {
      max_parallel      = 1
      health_check      = "checks"
      min_healthy_time  = "15s"
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
        static       = 5432
        host_network = "loopback"
      }
    }

    volume "postgres" {
      type      = "host"
      source    = "rezics-postgres"
      read_only = false
    }

    task "postgres" {
      driver = "docker"

      config {
        image        = var.postgres_image
        force_pull   = true
        network_mode = "host"
        ports        = ["postgres"]
        args = [
          "-c", "listen_addresses=127.0.0.1",
          "-c", "unix_socket_directories=/var/lib/postgresql/18/docker",
          "-c", "wal_level=logical",
          "-c", "max_replication_slots=10",
          "-c", "max_wal_senders=10",
          "-c", "max_slot_wal_keep_size=32GB",
          "-c", "shared_preload_libraries=pg_stat_statements",
          "-c", "compute_query_id=on",
          "-c", "pg_stat_statements.track=all",
          "-c", "track_io_timing=on",
          "-c", "track_wal_io_timing=on",
          "-c", "password_encryption=scram-sha-256",
        ]
      }

      env {
        PGDATA      = "/var/lib/postgresql/18/docker"
        POSTGRES_DB = "rezics"
      }

      template {
        data = <<-EOH
        {{- with nomadVar "nomad/jobs/rezics-postgres/postgres/postgres" -}}
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
        name         = "rezics-postgres"
        port         = "postgres"
        address_mode = "host"

        check {
          name     = "postgres-tcp"
          type     = "tcp"
          interval = "10s"
          timeout  = "2s"
        }
      }

      kill_signal    = "SIGTERM"
      kill_timeout   = "60s"
      shutdown_delay = "5s"

      resources {
        cpu    = 1500
        memory = 3072
      }
    }
  }
}
