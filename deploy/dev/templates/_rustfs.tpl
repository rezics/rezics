[[ define "rustfs" -]]
  group "rustfs" {
    service {
      name     = "rustfs"
      port     = "s3"
      provider = "nomad"
    }

    network {
      port "s3" {
        to           = 9000
        host_network = "loopback"
      }
      port "console" {
        to           = 9001
        host_network = "loopback"
      }
    }

    task "rustfs" {
      driver = "docker"

      config {
        image           = "rustfs/rustfs"
        network_mode    = "[[ var "network" . ]]"
        network_aliases = ["rustfs"]
        ports           = ["s3", "console"]
        args            = ["server", "/data", "--console-address", ":9001"]

        mount {
          type   = "volume"
          source = "rezics-rustfs"
          target = "/data"
        }
      }

      env {
        RUSTFS_ROOT_USER     = "[[ var "rustfs_root_user" . ]]"
        RUSTFS_ROOT_PASSWORD = "[[ var "rustfs_root_password" . ]]"
      }

      resources {
        cpu    = 100
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
          "until mc alias set local http://rustfs:9000 [[ var "rustfs_root_user" . ]] [[ var "rustfs_root_password" . ]] 2>/dev/null; do sleep 2; done && mc mb --ignore-existing local/[[ var "rustfs_bucket" . ]] && mc anonymous set download local/[[ var "rustfs_bucket" . ]]",
        ]
      }

      resources {
        cpu    = 50
        memory = 64
      }
    }
  }
[[- end ]]
