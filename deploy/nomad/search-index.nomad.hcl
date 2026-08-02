variable "release" {
  type    = string
  default = "manual"
}

variable "database_image" {
  type = string
}

variable "search_action" {
  type = string
}

variable "search_projection" {
  type = string
}

variable "search_index_uid" {
  type = string
}

job "rezics-search-index" {
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

    task "search-index" {
      driver = "docker"

      config {
        image        = var.database_image
        force_pull   = true
        network_mode = "host"
        args = [
          "search-index",
          var.search_action,
          var.search_projection,
          var.search_index_uid,
        ]
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
        cpu    = 1500
        memory = 2048
      }
    }
  }
}
