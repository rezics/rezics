[[ define "rustfs" -]]
  group "rustfs" {
    service {
      name     = "rustfs"
      port     = "s3"
      provider = "nomad"

      check {
        type     = "tcp"
        port     = "s3"
        interval = "10s"
        timeout  = "2s"
      }
    }

    network {
      port "s3" {
        to = 9000
      }
    }

    task "rustfs" {
      driver = "docker"

      config {
        image           = "rustfs/rustfs"
        network_mode    = "[[ var "network" . ]]"
        network_aliases = ["rustfs"]
        ports           = ["s3"]
        args            = ["server", "/data"]

        mount {
          type   = "volume"
          source = "rezics-prod-rustfs"
          target = "/data"
        }
      }

      env {
        RUSTFS_ROOT_USER     = "[[ var "s3_access_key_id" . ]]"
        RUSTFS_ROOT_PASSWORD = "[[ var "s3_secret_access_key" . ]]"
      }

      resources {
        cpu    = 200
        memory = 256
      }
    }

    task "setup" {
      lifecycle {
        hook    = "poststart"
        sidecar = false
      }

      driver = "docker"

      config {
        image        = "minio/mc"
        network_mode = "[[ var "network" . ]]"
        entrypoint   = ["/bin/sh", "-c"]
        args = [
          "until mc alias set local http://rustfs:9000 [[ var "s3_access_key_id" . ]] [[ var "s3_secret_access_key" . ]] 2>/dev/null; do sleep 2; done && mc mb --ignore-existing local/[[ var "s3_bucket" . ]] && mc anonymous set download local/[[ var "s3_bucket" . ]]",
        ]
      }

      resources {
        cpu    = 50
        memory = 64
      }
    }
  }
[[- end ]]
