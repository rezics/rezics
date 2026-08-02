variable "valkey_image" {
  type    = string
  default = "valkey/valkey:8.1.9-alpine3.24@sha256:a038175878d66b9d274fbf8be73c0305e93798b83917647f167e18cef3c71eec"
}

job "rezics-sequin-valkey" {
  namespace   = "rezics-infrastructure"
  datacenters = ["dc1"]
  type        = "service"

  group "valkey" {
    count = 1

    update {
      max_parallel      = 1
      health_check      = "checks"
      min_healthy_time  = "10s"
      healthy_deadline  = "10m"
      progress_deadline = "15m"
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

      port "valkey" {
        static       = 6379
        host_network = "loopback"
      }
    }

    volume "valkey" {
      type      = "host"
      source    = "rezics-sequin-valkey"
      read_only = false
    }

    task "valkey" {
      driver = "docker"

      config {
        image        = var.valkey_image
        force_pull   = true
        network_mode = "host"
        ports        = ["valkey"]
        command      = "/bin/sh"
        args = [
          "-ec",
          "exec valkey-server --bind 127.0.0.1 --appendonly yes --requirepass \"$VALKEY_PASSWORD\"",
        ]
      }

      template {
        data = <<-EOH
        {{- with nomadVar "nomad/jobs/rezics-sequin-valkey/valkey/valkey" -}}
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
        volume      = "valkey"
        destination = "/data"
        read_only   = false
      }

      service {
        provider     = "nomad"
        name         = "rezics-sequin-valkey"
        port         = "valkey"
        address_mode = "host"

        check {
          name     = "sequin-valkey-tcp"
          type     = "tcp"
          interval = "10s"
          timeout  = "2s"
        }
      }

      kill_signal    = "SIGTERM"
      kill_timeout   = "30s"
      shutdown_delay = "5s"

      resources {
        cpu    = 500
        memory = 1024
      }
    }
  }
}
