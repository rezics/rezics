variable "release" {
  type    = string
  default = "manual"
}

variable "database_image" {
  type = string
}

job "rezics-database-verify" {
  namespace   = "rezics"
  datacenters = ["dc1"]
  type        = "batch"

  meta {
    release = var.release
  }

  group "database" {
    count = 1

    restart {
      attempts = 0
      mode     = "fail"
    }

    reschedule {
      attempts  = 0
      unlimited = false
    }

    network {
      mode = "host"
    }

    task "verify" {
      driver = "docker"

      config {
        image        = var.database_image
        force_pull   = true
        network_mode = "host"
        args         = ["verify"]
      }

      env {
        DEPLOYMENT_ENVIRONMENT = "production"
        NODE_ENV               = "production"
      }

      template {
        data = <<-EOH
        {{- with nomadVar "database/operations" -}}
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
      kill_timeout = "2m"

      resources {
        cpu    = 1000
        memory = 1536
      }
    }
  }
}
