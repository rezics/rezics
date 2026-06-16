# RustFS — S3-compatible object storage for media uploads
# RustFS — 用于媒体上传的 S3 兼容对象存储

job "infra-rustfs" {
  datacenters = ["dc1"]
  type        = "service"

  update {
    max_parallel = 0
  }

  group "rustfs" {
    count = 1

    network {
      port "s3" {
        static = 9000
        to     = 9000
      }
      port "console" {
        static = 9001
        to     = 9001
      }
    }

    volume "rustfs-data" {
      type      = "host"
      source    = "rustfs-data"
      read_only = false
    }

    service {
      name     = "rustfs"
      port     = "s3"
      provider = "nomad"

      check {
        type     = "http"
        path     = "/minio/health/live"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "rustfs" {
      driver = "docker"

      config {
        image = "rustfs/rustfs:latest"
        ports = ["s3", "console"]
        args  = ["server", "/data", "--console-address", ":9001"]
      }

      volume_mount {
        volume      = "rustfs-data"
        destination = "/data"
        read_only   = false
      }

      template {
        data        = <<-EOT
{{ with nomadVar "rezics/infra" }}
RUSTFS_ACCESS_KEY={{ .RUSTFS_ACCESS_KEY }}
RUSTFS_SECRET_KEY={{ .RUSTFS_SECRET_KEY }}
{{ end }}
EOT
        destination = "secrets/env.env"
        env         = true
      }

      resources {
        cpu        = 300
        memory     = 256
        memory_max = 512
      }
    }

    task "rustfs-setup" {
      driver = "docker"

      lifecycle {
        hook    = "poststart"
        sidecar = false
      }

      config {
        image      = "minio/mc:latest"
        entrypoint = ["/bin/sh", "-c"]
        args       = [<<-SCRIPT
          until mc alias set rustfs http://localhost:9000 "$RUSTFS_ACCESS_KEY" "$RUSTFS_SECRET_KEY" 2>/dev/null; do
            echo "Waiting for RustFS..."
            sleep 2
          done
          mc mb --ignore-existing rustfs/rezics
          mc anonymous set download rustfs/rezics
          echo "RustFS setup complete."
        SCRIPT
        ]
        network_mode = "host"
      }

      template {
        data        = <<-EOT
{{ with nomadVar "rezics/infra" }}
RUSTFS_ACCESS_KEY={{ .RUSTFS_ACCESS_KEY }}
RUSTFS_SECRET_KEY={{ .RUSTFS_SECRET_KEY }}
{{ end }}
EOT
        destination = "secrets/env.env"
        env         = true
      }

      resources {
        cpu    = 100
        memory = 64
      }
    }
  }
}
