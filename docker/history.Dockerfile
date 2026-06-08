# History service image. Cross-schema: the outbox consumer reads the main DB via
# `@rezics/server/db` Drizzle helpers and writes history rows through
# `@rezics/history/db`. Drizzle uses the pure-JS `pg` driver, so no query
# engine is copied into the runtime stage.
#
#   docker build -f docker/base.Dockerfile -t rezics-base:dev .
#   docker build -f docker/history.Dockerfile -t rezics-history:dev .

# --- build stage -----------------------------------------------------------
FROM rezics-base:dev AS build

WORKDIR /repo/package/history
ENV HISTORY_DATABASE_URL="postgresql://build:build@localhost:5432/build"
# Compile the linux-x64 binary inline (mirrors `task history:build:linux`).
RUN bun build src/cluster.ts --compile --minify-whitespace --minify-syntax \
  --target bun-linux-x64 --outfile history

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
