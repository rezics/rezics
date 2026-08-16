variable "runner_image" {
  type = string
}

variable "verification_postgres_image_repository" {
  type = string
}

job "rezics-databasus-verification-agent" {
  namespace   = "rezics-infrastructure"
  datacenters = ["dc1"]
  type        = "service"

  group "verification-agent" {
    count = 1

    constraint {
      attribute = "${meta.role}"
      operator  = "="
      value     = "data"
    }

    restart {
      attempts = 10
      interval = "30m"
      delay    = "15s"
      mode     = "delay"
    }

    network {
      mode = "host"
    }

    task "verification-agent" {
      driver = "docker"

      config {
        image        = var.runner_image
        force_pull   = true
        network_mode = "host"
        command      = "/bin/sh"
        args = [
          "-ec",
          <<-EOS
          cd /local
          until wget -q -O /alloc/data/verification-agent 'http://127.0.0.1:4005/api/v1/system/verification-agent?arch=amd64'; do
            sleep 2
          done
          chmod 0500 /alloc/data/verification-agent
          exec /alloc/data/verification-agent run --skip-update
          EOS
        ]
        volumes = ["/var/run/docker.sock:/var/run/docker.sock"]
      }

      template {
        data = <<-EOH
        {{ with nomadVar "database/databasus-verification-agent" }}
        {
          "databasusHost": "http://127.0.0.1:4005",
          "agentId": {{ .DATABASUS_VERIFICATION_AGENT_ID | toJSON }},
          "token": {{ .DATABASUS_VERIFICATION_AGENT_TOKEN | toJSON }},
          "maxCpu": 2,
          "maxRamMb": 4096,
          "maxDiskGb": 200,
          "maxConcurrentJobs": 1,
          "allowInsecureHttp": true,
          "verificationPgImageRepo": ${jsonencode(var.verification_postgres_image_repository)}
        }
        {{- end }}
        EOH

        destination = "local/databasus-verification.json"
        perms       = "0400"
        change_mode = "restart"
      }

      kill_signal  = "SIGTERM"
      kill_timeout = "10m"

      resources {
        cpu        = 500
        memory     = 512
        memory_max = 1024
      }
    }
  }
}
