# History service image. Cross-schema: the outbox consumer dynamically imports
# `@rezics/server`'s generated Prisma client to read the main DB, so that
# client must be generated alongside history's own before the compile bundles
# both. Both are engineless (Prisma 7 + pg adapter) — no query engine to copy.
#
#   docker build -f docker/base.Dockerfile -t rezics-base:dev .
#   docker build -f docker/history.Dockerfile -t rezics-history:dev .

# --- build stage -----------------------------------------------------------
FROM rezics-base:dev AS build

# Generate the main-DB client (read-only consumer) with a dummy URL.
WORKDIR /repo/package/server
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN bunx prisma generate

# Generate history's own client and compile.
WORKDIR /repo/package/history
ENV HISTORY_DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN bunx prisma generate
RUN bun run build:linux

# --- runtime stage ---------------------------------------------------------
FROM debian:bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --uid 10001 --no-create-home rezics
WORKDIR /app

COPY --from=build /repo/package/history/history /app/history

USER rezics
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/ready" || exit 1

ENTRYPOINT ["/app/history"]
