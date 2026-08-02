variable "sequin_image" {
  type = string
}

job "rezics-sequin" {
  namespace   = "rezics-infrastructure"
  datacenters = ["dc1"]
  type        = "service"

  group "sequin" {
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

      port "http" {
        static       = 7376
        host_network = "loopback"
      }

      port "metrics" {
        static       = 8376
        host_network = "loopback"
      }
    }

    task "sequin" {
      driver = "docker"

      config {
        image        = var.sequin_image
        force_pull   = true
        network_mode = "host"
        ports        = ["http", "metrics"]
      }

      env {
        CONFIG_FILE_PATH               = "/config/sequin.yaml"
        CRASH_REPORTING_DISABLED       = "true"
        FEATURE_ACCOUNT_SELF_SIGNUP    = "false"
        FEATURE_PROVISION_DEFAULT_USER = "false"
        MAX_MEMORY_MB                  = "2048"
        MEILISEARCH_INTERNAL_URL       = "http://127.0.0.1:7700"
        PG_DATABASE                    = "sequin"
        PG_HOSTNAME                    = "127.0.0.1"
        PG_POOL_SIZE                   = "20"
        PG_PORT                        = "5433"
        PG_USERNAME                    = "sequin"
        SEQUIN_METRICS_PORT            = "8376"
        SEQUIN_SOURCE_DATABASE         = "rezics"
        SEQUIN_SOURCE_HOST             = "127.0.0.1"
        SEQUIN_SOURCE_PORT             = "5432"
        SEQUIN_TELEMETRY_DISABLED      = "true"
        SERVER_CHECK_ORIGIN            = "false"
        SERVER_HOST                    = "127.0.0.1"
        SERVER_PORT                    = "7376"
      }

      template {
        data = <<-EOH
        {{- with nomadVar "nomad/jobs/rezics-sequin/sequin/sequin" -}}
        {{- range .Tuples }}
        {{ .K }}={{ .V | toJSON }}
        {{- end }}
        {{- end }}
        EOH

        destination = "secrets/runtime.env"
        env         = true
        change_mode = "restart"
      }

      service {
        provider     = "nomad"
        name         = "rezics-sequin"
        port         = "http"
        address_mode = "host"

        check {
          name     = "sequin-health"
          type     = "http"
          path     = "/health"
          interval = "10s"
          timeout  = "5s"
        }
      }

      kill_signal    = "SIGTERM"
      kill_timeout   = "30s"
      shutdown_delay = "5s"

      resources {
        cpu    = 1500
        memory = 2560
      }
    }
  }
}
