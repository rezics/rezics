# Ranking service image. INTERNAL-ONLY (no public proxy route, no public CORS
# — enforced by Kamal routing, not here). Cross-schema: reads the main DB via
# `@rezics/server/db` Drizzle helpers and writes ranking rows through its own
# Drizzle schema.
#
#   docker build -f docker/base.Dockerfile -t rezics-base:dev .
#   docker build -f docker/ranking.Dockerfile -t rezics-ranking:dev .

# --- build stage -----------------------------------------------------------
FROM rezics-base:dev AS build

WORKDIR /repo/package/ranking
ENV RANKING_DATABASE_URL="postgresql://build:build@localhost:5432/build"
# Compile the linux-x64 binary inline (mirrors `task ranking:build:linux`).
RUN bun build src/cluster.ts --compile --minify-whitespace --minify-syntax \
  --target bun-linux-x64 --outfile ranking

# --- runtime stage ---------------------------------------------------------
FROM debian:bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --uid 10001 --no-create-home rezics
WORKDIR /app

COPY --from=build /repo/package/ranking/ranking /app/ranking

USER rezics
ENV PORT=3006
EXPOSE 3006

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/ranking/ready" || exit 1

ENTRYPOINT ["/app/ranking"]
