# Preview service image. Serves bot-friendly HTML/XML behind the edge router.
#
# Build (repo root context), after building the shared base:
#   docker build -f docker/base.Dockerfile -t rezics-base:dev .
#   docker build -f docker/preview.Dockerfile -t rezics-preview:dev .

# --- build stage -----------------------------------------------------------
FROM rezics-base:dev AS build
WORKDIR /repo/package/preview

# Compile the linux-x64 binary inline (mirrors `task preview:build:linux`).
RUN bun build src/index.ts --compile --minify-whitespace --minify-syntax \
  --target bun-linux-x64 --outfile preview

# --- runtime stage ---------------------------------------------------------
FROM debian:bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --uid 10001 --no-create-home rezics
WORKDIR /app

COPY --from=build /repo/package/preview/preview /app/preview

USER rezics
ENV SERVER_PORT=3006
EXPOSE 3006

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${SERVER_PORT}/health" || exit 1

ENTRYPOINT ["/app/preview"]
