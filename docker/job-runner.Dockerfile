# Job-runner image. No schema of its own (pg-boss tables live in
# JOB_DATABASE_URL), but it imports `@rezics/server`'s and `@rezics/history`'s
# generated clients, so both must be generated before the compile. One binary,
# role-switched at runtime via JOB_RUNNER_ROLE (all | http | worker) — Kamal
# runs the HTTP and worker roles off this same image.
#
#   docker build -f docker/base.Dockerfile -t rezics-base:dev .
#   docker build -f docker/job-runner.Dockerfile -t rezics-job-runner:dev .
#
# KNOWN BLOCKER (upstream, not Docker): `bun run build:linux` for job-runner
# currently fails — it bundles `@rezics/history` source that does
# `import("#/prisma/client")`, and Bun's `--compile` bundler resolves that
# package-local `#` subpath against the entry package (job-runner) instead of
# history, so it cannot be found. This reproduces with a plain local
# `build:linux` too. Unblock as part of deployment task 2.5/2.6 by making the
# cross-package self-imports portable (e.g. replace `#/prisma/client` self-
# references in server/history with package-qualified or relative specifiers).
# The stages below are correct and will produce the binary once that lands.

# --- build stage -----------------------------------------------------------
FROM rezics-base:dev AS build

WORKDIR /repo/package/server
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN bunx prisma generate

WORKDIR /repo/package/history
ENV HISTORY_DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN bunx prisma generate

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
