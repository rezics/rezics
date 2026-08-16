variable "release" {
  type    = string
  default = "manual"
}

variable "api_image" {
  type = string
}

job "rezics-api" {
  namespace   = "rezics"
  datacenters = ["dc1"]
  type        = "service"

  meta {
    release = var.release
  }

  group "api" {
    count = 4

    constraint {
      attribute = "${meta.role}"
      operator  = "="
      value     = "edge"
    }

    scaling {
      enabled = true
      min     = 4
      max     = 8

      policy {
        cooldown            = "1m"
        evaluation_interval = "15s"
        on_check_error      = "fail"

        check "api_cpu" {
          source = "nomad-apm"
          query  = "avg_cpu-allocated"

          strategy "target-value" {
            target         = 65
            threshold      = 0.15
            max_scale_up   = 2
            max_scale_down = 1
          }
        }
      }
    }

    update {
      canary            = 1
      max_parallel      = 1
      health_check      = "checks"
      min_healthy_time  = "15s"
      healthy_deadline  = "5m"
      progress_deadline = "10m"
      auto_promote      = true
      auto_revert       = true
    }

    restart {
      attempts = 3
      interval = "10m"
      delay    = "10s"
      mode     = "delay"
    }

    network {
      mode = "host"

      port "api" {
        host_network = "loopback"
      }
    }

    task "api" {
      driver = "docker"

      config {
        image        = var.api_image
        force_pull   = true
        network_mode = "host"
        ports        = ["api"]
      }

      env {
        DEPLOYMENT_ENVIRONMENT = "production"
        DATABASE_POOL_MAX      = "6"
        NODE_ENV               = "production"
        REZICS_RELEASE         = var.release
      }

      template {
        data = <<-EOH
        HOST=127.0.0.1
        PORT={{ env "NOMAD_PORT_api" }}
        {{- with nomadVar "application/runtime" }}
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
        name         = "rezics-api"
        port         = "api"
        address_mode = "host"
        tags = [
          "traefik.enable=true",
          "traefik.http.routers.rezics-api.entrypoints=web",
          "traefik.http.routers.rezics-api.rule=Host(`api.rezics.com`)",
        ]
        canary_tags = [
          "traefik.enable=true",
          "traefik.http.routers.rezics-api-canary.entrypoints=web",
          "traefik.http.routers.rezics-api-canary.rule=Host(`canary-api.rezics.internal`)",
        ]

        check {
          name      = "api-readiness"
          type      = "http"
          path      = "/api/v1/ready"
          interval  = "5s"
          timeout   = "3s"
          on_update = "require_healthy"
        }

        check {
          name      = "api-liveness"
          type      = "http"
          path      = "/api/v1/health"
          interval  = "10s"
          timeout   = "1s"
          on_update = "require_healthy"

          check_restart {
            limit = 3
            grace = "10s"
          }
        }
      }

      kill_signal    = "SIGTERM"
      kill_timeout   = "30s"
      shutdown_delay = "10s"

      resources {
        cpu        = 1500
        memory     = 512
        memory_max = 1536
      }
    }
  }
}
