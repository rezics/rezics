variable "pgbouncer_image" {
  type = string
}

variable "pgbouncer_bind_address" {
  type    = string
  default = "10.64.0.2"
}

job "rezics-pgbouncer" {
  namespace   = "rezics-infrastructure"
  datacenters = ["dc1"]
  type        = "service"

  group "pgbouncer" {
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
      healthy_deadline  = "5m"
      progress_deadline = "10m"
      auto_revert       = true
    }

    restart {
      attempts = 10
      interval = "30m"
      delay    = "10s"
      mode     = "delay"
    }

    network {
      mode = "host"

      port "pgbouncer" {
        static       = 6432
        host_network = "wireguard"
      }
    }

    task "pgbouncer" {
      driver = "docker"

      config {
        image        = var.pgbouncer_image
        force_pull   = true
        network_mode = "host"
        ports        = ["pgbouncer"]
        entrypoint   = ["/usr/bin/pgbouncer"]
        args         = ["/secrets/pgbouncer.ini"]
      }

      template {
        data = <<-EOH
        [databases]
        rezics = host=127.0.0.1 port=5432 dbname=rezics pool_mode=transaction pool_size=40 min_pool_size=16 reserve_pool_size=8 max_db_connections=48 max_db_client_connections=480
        rezics_session = host=127.0.0.1 port=5432 dbname=rezics pool_mode=session pool_size=4 max_db_connections=4 max_db_client_connections=16

        [pgbouncer]
        listen_addr = ${var.pgbouncer_bind_address}
        listen_port = 6432
        listen_backlog = 1024
        unix_socket_dir =
        auth_type = scram-sha-256
        auth_file = /secrets/userlist.txt
        max_client_conn = 512
        default_pool_size = 40
        min_pool_size = 16
        reserve_pool_size = 8
        reserve_pool_timeout = 1
        max_prepared_statements = 256
        query_wait_timeout = 5
        idle_transaction_timeout = 15
        server_connect_timeout = 5
        server_login_retry = 1
        server_idle_timeout = 300
        server_lifetime = 3600
        application_name_add_host = 1
        stats_period = 60
        log_connections = 0
        log_disconnections = 0
        log_pooler_errors = 1
        log_stats = 1
        EOH

        destination = "secrets/pgbouncer.ini"
        change_mode = "restart"
        perms       = "0400"
        uid         = 70
        gid         = 70
      }

      template {
        data = <<-EOH
        {{- with nomadVar "nomad/jobs/rezics-postgres/postgres/postgres" -}}
        {{ .REZICS_DATABASE_USERNAME | toJSON }} {{ .REZICS_DATABASE_PASSWORD | toJSON }}
        {{- end -}}
        EOH

        destination = "secrets/userlist.txt"
        change_mode = "restart"
        perms       = "0400"
        uid         = 70
        gid         = 70
      }

      service {
        provider     = "nomad"
        name         = "rezics-pgbouncer"
        port         = "pgbouncer"
        address_mode = "host"

        check {
          name     = "pgbouncer-tcp"
          type     = "tcp"
          interval = "10s"
          timeout  = "2s"
        }
      }

      kill_signal    = "SIGTERM"
      kill_timeout   = "30s"
      shutdown_delay = "5s"

      resources {
        cpu        = 500
        memory     = 128
        memory_max = 512
      }
    }
  }
}
