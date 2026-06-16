# OpenTelemetry Collector — optional observability pipeline
# OpenTelemetry Collector — 可选的可观测性管道

job "infra-otel" {
  datacenters = ["dc1"]
  type        = "service"

  group "otel" {
    count = 1

    network {
      port "grpc" {
        static = 4317
        to     = 4317
      }
      port "http" {
        static = 4318
        to     = 4318
      }
    }

    service {
      name     = "otel-collector"
      port     = "http"
      provider = "nomad"
    }

    task "otel-collector" {
      driver = "docker"

      config {
        image = "otel/opentelemetry-collector-contrib:0.153.0"
        ports = ["grpc", "http"]
        args  = ["--config=/etc/otelcol-contrib/config.yml"]
        volumes = [
          "/opt/nomad/config/otel-collector.yml:/etc/otelcol-contrib/config.yml:ro",
        ]
      }

      resources {
        cpu    = 200
        memory = 256
      }
    }
  }
}
