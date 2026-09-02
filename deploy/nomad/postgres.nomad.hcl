variable "postgres_image" {
  type = string
}

variable "postgres_bind_address" {
  type    = string
  default = "10.64.0.2"
}

job "rezics-postgres" {
  namespace   = "rezics-infrastructure"
  datacenters = ["dc1"]
  type        = "service"

  group "postgres" {
    count = 1

    constraint {
      attribute = "${meta.role}"
      operator  = "="
      value     = "data"
    }

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
        host_network = "wireguard"
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
          "-c", "listen_addresses=${var.postgres_bind_address}",
          "-c", "wal_level=replica",
          "-c", "max_replication_slots=0",
          "-c", "max_wal_senders=10",
          "-c", "max_wal_size=16GB",
          "-c", "min_wal_size=4GB",
          "-c", "wal_compression=lz4",
          "-c", "wal_buffers=64MB",
          "-c", "checkpoint_timeout=15min",
          "-c", "checkpoint_completion_target=0.9",
          "-c", "max_connections=120",
          "-c", "reserved_connections=10",
          "-c", "superuser_reserved_connections=3",
          "-c", "shared_buffers=12GB",
          "-c", "effective_cache_size=36GB",
          "-c", "work_mem=8MB",
          "-c", "maintenance_work_mem=1GB",
          "-c", "autovacuum_work_mem=512MB",
          "-c", "huge_pages=try",
          "-c", "effective_io_concurrency=128",
          "-c", "maintenance_io_concurrency=64",
          "-c", "io_method=worker",
          "-c", "io_workers=8",
          "-c", "io_max_concurrency=64",
          "-c", "random_page_cost=1.2",
          "-c", "seq_page_cost=1.0",
          "-c", "default_statistics_target=200",
          "-c", "jit=off",
          "-c", "max_worker_processes=16",
          "-c", "max_parallel_workers=12",
          "-c", "max_parallel_workers_per_gather=2",
          "-c", "max_parallel_maintenance_workers=4",
          "-c", "autovacuum_worker_slots=8",
          "-c", "autovacuum_max_workers=6",
          "-c", "autovacuum_naptime=10s",
          "-c", "autovacuum_vacuum_threshold=1000",
          "-c", "autovacuum_vacuum_scale_factor=0.01",
          "-c", "autovacuum_vacuum_max_threshold=1000000",
          "-c", "autovacuum_analyze_threshold=1000",
          "-c", "autovacuum_analyze_scale_factor=0.005",
          "-c", "autovacuum_vacuum_cost_delay=2ms",
          "-c", "autovacuum_vacuum_cost_limit=2000",
          "-c", "vacuum_buffer_usage_limit=64MB",
          "-c", "shared_preload_libraries=pg_stat_statements,pgroonga_wal_resource_manager,pgroonga_crash_safer",
          "-c", "pgroonga.enable_wal_resource_manager=on",
          "-c", "pgroonga.enable_wal=off",
          "-c", "pgroonga.enable_crash_safe=on",
          "-c", "compute_query_id=on",
          "-c", "pg_stat_statements.track=top",
          "-c", "pg_stat_statements.max=20000",
          "-c", "track_io_timing=on",
          "-c", "track_wal_io_timing=on",
          "-c", "idle_in_transaction_session_timeout=15s",
          "-c", "log_lock_waits=on",
          "-c", "deadlock_timeout=1s",
          "-c", "log_autovacuum_min_duration=1s",
          "-c", "log_temp_files=64MB",
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

      kill_signal    = "SIGINT"
      kill_timeout   = "2m"
      shutdown_delay = "5s"

      resources {
        cpu        = 24000
        memory     = 24576
        memory_max = 45056
      }
    }
  }
}
