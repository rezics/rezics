# Auth service image. Own schema; compiles the cluster entrypoint
# (src/cluster.ts → binary named `server`). Engineless Prisma 7 + pg adapter.
#
#   docker build -f docker/base.Dockerfile -t rezics-base:dev .
#   docker build -f docker/auth.Dockerfile -t rezics-auth:dev .

# --- build stage -----------------------------------------------------------
FROM rezics-base:dev AS build
WORKDIR /repo/package/auth

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

# build:linux emits a binary named `server`; rename to `auth` for clarity.
COPY --from=build /repo/package/auth/server /app/auth

USER rezics
ENV PORT=3001
ENV WORKERS=""
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

ENTRYPOINT ["/app/auth"]
