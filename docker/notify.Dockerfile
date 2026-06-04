# Notify service image. Self-contained schema (like reaction): Drizzle uses the
# pure-JS `pg` driver, so the compiled binary needs no query engine.
#
#   docker build -f docker/base.Dockerfile -t rezics-base:dev .
#   docker build -f docker/notify.Dockerfile -t rezics-notify:dev .

# --- build stage -----------------------------------------------------------
FROM rezics-base:dev AS build
WORKDIR /repo/package/notify

ENV NOTIFY_DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN bun run build:linux

# --- runtime stage ---------------------------------------------------------
FROM debian:bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --uid 10001 --no-create-home rezics
WORKDIR /app

COPY --from=build /repo/package/notify/notify /app/notify

USER rezics
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

ENTRYPOINT ["/app/notify"]
