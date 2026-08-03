# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:26-bookworm-slim@sha256:9e6f9357d371591e32ab6f2d8a26d63bdd0d17c29eee3f4f3e7e454d9634bf73
ARG BUN_IMAGE=oven/bun:1.3.11-slim@sha256:478281fdd196871c7e51ba6a820b7803a8ae97042ec86cdbc2e1c6b6626442d9
ARG POSTGRES_IMAGE=postgres:18.4-trixie@sha256:3a82e1f56c8f0f5616a11103ac3d47e632c3938698946a7ad26da0df1334744a
ARG SEQUIN_IMAGE=sequin/sequin:v0.14.6@sha256:336759c1c632ebdc87939bcea70b26b46df6593e666088e1bf29058209437d3e
ARG COREPACK_VERSION=0.35.0

FROM ${NODE_IMAGE} AS node-tooling

ARG COREPACK_VERSION
RUN apt-get update \
	&& apt-get install --yes --no-install-recommends ca-certificates curl \
	&& rm -rf /var/lib/apt/lists/* \
	&& npm install --global "corepack@${COREPACK_VERSION}" \
	&& corepack enable

FROM node-tooling AS backend-dependency-manifests

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /workspace

COPY LICENSE THIRD_PARTY_NOTICES.md package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases/yarn-4.17.1.cjs .yarn/releases/yarn-4.17.1.cjs
COPY libraries/access/package.json libraries/access/package.json
COPY libraries/avatar/package.json libraries/avatar/package.json
COPY libraries/block/package.json libraries/block/package.json
COPY libraries/email/package.json libraries/email/package.json
COPY libraries/filter/package.json libraries/filter/package.json
COPY libraries/i18n/package.json libraries/i18n/package.json
COPY libraries/license/package.json libraries/license/package.json
COPY libraries/observability/package.json libraries/observability/package.json
COPY libraries/portable-text/package.json libraries/portable-text/package.json
COPY libraries/slug/package.json libraries/slug/package.json
COPY packages/brand/package.json packages/brand/package.json
COPY services/main/package.json services/main/package.json

FROM scratch AS backend-source

COPY libraries/access /libraries/access
COPY libraries/avatar /libraries/avatar
COPY libraries/block /libraries/block
COPY libraries/email /libraries/email
COPY libraries/filter /libraries/filter
COPY libraries/i18n /libraries/i18n
COPY libraries/license /libraries/license
COPY libraries/observability /libraries/observability
COPY libraries/portable-text /libraries/portable-text
COPY libraries/slug /libraries/slug
COPY packages/brand /packages/brand
COPY services/main /services/main

FROM backend-dependency-manifests AS main-dependencies
RUN --mount=type=cache,target=/root/.yarn/berry/cache \
	yarn workspaces focus @rezics/backend --production
COPY --from=backend-source / /workspace/

FROM ${BUN_IMAGE} AS backend-runtime

ENV DEPLOYMENT_ENVIRONMENT=production \
    HOST=127.0.0.1 \
    NODE_ENV=production \
    PORT=3001 \
    WORKER_HEALTH_HOST=127.0.0.1 \
    WORKER_HEALTH_PORT=3002
WORKDIR /workspace

COPY --from=main-dependencies --chown=bun:bun /workspace /workspace

USER bun
EXPOSE 3001 3002

FROM backend-runtime AS api

CMD ["bun", "services/main/src/index.ts"]

FROM backend-runtime AS worker

CMD ["bun", "services/main/src/worker.ts"]

FROM backend-dependency-manifests AS database-dependencies
RUN --mount=type=cache,target=/root/.yarn/berry/cache \
	yarn workspaces focus @rezics/backend
COPY --from=backend-source / /workspace/
COPY deploy/scripts/database-operation.sh /workspace/deploy/scripts/database-operation.sh

FROM node-tooling AS database

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    DEPLOYMENT_ENVIRONMENT=production \
    NODE_ENV=production
WORKDIR /workspace

COPY --from=database-dependencies --chown=node:node /workspace /workspace

USER node
ENTRYPOINT ["bash", "/workspace/deploy/scripts/database-operation.sh"]

FROM ${POSTGRES_IMAGE} AS postgres

COPY --chmod=0755 services/main/docker/postgres/init /docker-entrypoint-initdb.d

FROM ${SEQUIN_IMAGE} AS sequin

COPY services/main/search /config
