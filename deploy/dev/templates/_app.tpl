[[ define "app" -]]
  group "app" {
    network {
      port "server" {
        static       = 3000
        host_network = "loopback"
      }
      port "auth" {
        static       = 3001
        host_network = "loopback"
      }
      port "notify" {
        static       = 3002
        host_network = "loopback"
      }
      port "reaction" {
        static       = 3003
        host_network = "loopback"
      }
      port "history" {
        static       = 3004
        host_network = "loopback"
      }
      port "job_runner" {
        static       = 3005
        host_network = "loopback"
      }
      port "ranking" {
        static       = 3006
        host_network = "loopback"
      }
      port "app" {
        static       = 35001
        host_network = "loopback"
      }
      port "admin" {
        static       = 35002
        host_network = "loopback"
      }
    }

    # ── server ──────────────────────────────────────────────

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
        exec task server:dev
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

    # ── auth ────────────────────────────────────────────────

    task "auth" {
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
        exec task auth:dev
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      env {
        NODE_ENV     = "development"
        DATABASE_URL = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@127.0.0.1:5432/rezics_auth"
      }

      resources {
        cpu        = 300
        memory     = 384
        memory_max = 512
      }
    }

    # ── notify ──────────────────────────────────────────────

    task "notify" {
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
        exec task notify:dev
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      env {
        NODE_ENV = "development"
      }

      resources {
        cpu    = 200
        memory = 256
      }
    }

    # ── reaction ────────────────────────────────────────────

    task "reaction" {
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
        exec task reaction:dev
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      env {
        NODE_ENV = "development"
      }

      resources {
        cpu    = 200
        memory = 256
      }
    }

    # ── history ─────────────────────────────────────────────

    task "history" {
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
        exec task history:dev
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      env {
        NODE_ENV = "development"
      }

      resources {
        cpu    = 200
        memory = 256
      }
    }

    # ── job-runner ──────────────────────────────────────────

    task "job-runner" {
      driver = "raw_exec"

      config {
        command = "/bin/sh"
        args    = ["${NOMAD_TASK_DIR}/run.sh"]
      }

      template {
        data        = <<-SCRIPT
        #!/bin/sh
        until pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null; do sleep 1; done
        until curl -sf http://127.0.0.1:7376/health >/dev/null 2>&1; do sleep 2; done
        cd [[ var "project_root" . ]]
        exec task job-runner:dev
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      env {
        NODE_ENV = "development"
      }

      resources {
        cpu    = 300
        memory = 384
      }
    }

    # ── ranking ─────────────────────────────────────────────

    task "ranking" {
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
        exec task ranking:dev
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      env {
        NODE_ENV = "development"
      }

      resources {
        cpu    = 200
        memory = 256
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
        exec task app:dev
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

    # ── admin (frontend) ────────────────────────────────────

    task "admin" {
      driver = "raw_exec"

      config {
        command = "/bin/sh"
        args    = ["${NOMAD_TASK_DIR}/run.sh"]
      }

      template {
        data        = <<-SCRIPT
        #!/bin/sh
        cd [[ var "project_root" . ]]
        exec task admin:dev
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      env {
        NODE_ENV = "development"
      }

      resources {
        cpu    = 300
        memory = 384
      }
    }
  }
[[- end ]]
