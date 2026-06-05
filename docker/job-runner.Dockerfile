# Job-runner image. No schema of its own (pg-boss tables live in
# JOB_DATABASE_URL). Search sync, history, and maintenance use exported
# Drizzle db helpers. One binary, role-switched at runtime via
# JOB_RUNNER_ROLE (all | http | worker) — Kamal runs the HTTP and worker
# roles off this same image.
#
#   docker build -f docker/base.Dockerfile -t rezics-base:dev .
#   docker build -f docker/job-runner.Dockerfile -t rezics-job-runner:dev .

# --- build stage -----------------------------------------------------------
FROM rezics-base:dev AS build

WORKDIR /repo/package/job-runner
RUN bun run build:linux

# --- runtime stage ---------------------------------------------------------
FROM debian:bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --uid 10001 --no-create-home rezics
WORKDIR /app

COPY --from=build /repo/package/job-runner/job-runner /app/job-runner

USER rezics
ENV PORT=3005
# all | http | worker. The worker role does not bind PORT.
ENV JOB_RUNNER_ROLE="all"
EXPOSE 3005

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/ready" || exit 1

ENTRYPOINT ["/app/job-runner"]
