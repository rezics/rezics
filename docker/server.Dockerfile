# Main API server image. Owns the primary schema; compiles the cluster
# entrypoint (src/cluster.ts). Engineless Prisma 7 + pg adapter.
#
#   docker build -f docker/base.Dockerfile -t rezics-base:dev .
#   docker build -f docker/server.Dockerfile -t rezics-server:dev .

# --- build stage -----------------------------------------------------------
FROM rezics-base:dev AS build
WORKDIR /repo/package/server

ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN bunx prisma generate
RUN bun run build:linux

# --- runtime stage ---------------------------------------------------------
FROM debian:bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --uid 10001 --no-create-home rezics
WORKDIR /app

COPY --from=build /repo/package/server/server /app/server

USER rezics
ENV PORT=3000
# Cluster worker count; the cluster entrypoint defaults sensibly when unset.
ENV WORKERS=""
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

ENTRYPOINT ["/app/server"]
