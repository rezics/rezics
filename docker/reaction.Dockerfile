# Reaction service image.
#
# Build (repo root context), after building the shared base:
#   docker build -f docker/base.Dockerfile -t rezics-base:dev .
#   docker build -f docker/reaction.Dockerfile -t rezics-reaction:dev .
#
# Prisma 7 here is engineless: the `prisma-client` generator emits plain
# TS/JS and queries run through `@prisma/adapter-pg` (pure-JS `pg`), so the
# `bun --compile` binary is fully self-contained — no Rust query engine to
# copy into the runtime stage.

# --- build stage -----------------------------------------------------------
FROM rezics-base:dev AS build
WORKDIR /repo/package/reaction

# Generate the engineless Prisma client. The dummy URL only satisfies the
# Prisma config's `env()` lookup — generate never connects, and the real
# datasource URL is supplied at runtime via the pg adapter.
ENV REACTION_DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN bunx prisma generate

# Compile the standalone Linux amd64 binary.
RUN bun run build:linux

# --- runtime stage ---------------------------------------------------------
# Slim glibc runtime (the bun-linux-x64 binary links glibc, not musl).
FROM debian:bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --uid 10001 --no-create-home rezics
WORKDIR /app

COPY --from=build /repo/package/reaction/reaction /app/reaction

USER rezics
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

ENTRYPOINT ["/app/reaction"]
