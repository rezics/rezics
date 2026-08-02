variable "meilisearch_image" {
  type    = string
  default = "getmeili/meilisearch:v1.51.0@sha256:a9eb29ee09ab4943db3b4c68620bd6f3382e6b2b0ac4431c0e607b48dbcd4c14"
}

job "rezics-meilisearch" {
  namespace   = "rezics-infrastructure"
  datacenters = ["dc1"]
  type        = "service"

  group "meilisearch" {
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

      port "http" {
        static       = 7700
        host_network = "loopback"
      }
    }

    volume "meilisearch" {
      type      = "host"
      source    = "rezics-meilisearch"
      read_only = false
    }

    task "meilisearch" {
      driver = "docker"

      config {
        image        = var.meilisearch_image
        force_pull   = true
        network_mode = "host"
        ports        = ["http"]
      }

      env {
        MEILI_ENV          = "production"
        MEILI_HTTP_ADDR    = "127.0.0.1:7700"
        MEILI_NO_ANALYTICS = "true"
      }

      template {
        data = <<-EOH
        {{- with nomadVar "nomad/jobs/rezics-meilisearch/meilisearch/meilisearch" -}}
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
        volume      = "meilisearch"
        destination = "/meili_data"
        read_only   = false
      }

      service {
        provider     = "nomad"
        name         = "rezics-meilisearch"
        port         = "http"
        address_mode = "host"

        check {
          name     = "meilisearch-health"
          type     = "http"
          path     = "/health"
          interval = "10s"
          timeout  = "2s"
        }
      }

      kill_signal    = "SIGTERM"
      kill_timeout   = "30s"
      shutdown_delay = "5s"

      resources {
        cpu    = 1500
        memory = 3072
      }
    }
  }
}
