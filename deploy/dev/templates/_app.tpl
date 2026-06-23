[[ define "app" -]]
  group "app" {
    network {
      port "server" {
        static       = 3000
        host_network = "loopback"
      }
      port "app" {
        static       = 35001
        host_network = "loopback"
      }
    }

    # ── server (backend) ────────────────────────────────────

    task "server" {
      driver = "raw_exec"

      config {
        command = "/bin/sh"
        args    = ["${NOMAD_TASK_DIR}/run.sh"]
      }

      template {
        data        = <<-SCRIPT
        #!/bin/sh
        until pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null; do sleep 1; done
        cd [[ var "project_root" . ]]
        exec task backend:dev
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      env {
        NODE_ENV     = "development"
        DATABASE_URL = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@127.0.0.1:5432/rezics_server"
      }

      resources {
        cpu        = 500
        memory     = 512
        memory_max = 768
      }
    }

    # ── app (frontend) ──────────────────────────────────────

    task "app" {
      driver = "raw_exec"

      config {
        command = "/bin/sh"
        args    = ["${NOMAD_TASK_DIR}/run.sh"]
      }

      template {
        data        = <<-SCRIPT
        #!/bin/sh
        cd [[ var "project_root" . ]]
        exec task frontend:dev
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      env {
        NODE_ENV = "development"
      }

      resources {
        cpu        = 500
        memory     = 512
        memory_max = 768
      }
    }
  }
[[- end ]]
