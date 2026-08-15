# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:26-bookworm-slim@sha256:9e6f9357d371591e32ab6f2d8a26d63bdd0d17c29eee3f4f3e7e454d9634bf73
ARG BUN_IMAGE=oven/bun:1.3.11-slim@sha256:478281fdd196871c7e51ba6a820b7803a8ae97042ec86cdbc2e1c6b6626442d9
ARG POSTGRES_IMAGE=postgres:18.4-trixie@sha256:3a82e1f56c8f0f5616a11103ac3d47e632c3938698946a7ad26da0df1334744a
ARG COREPACK_VERSION=0.35.0
ARG BUN_VERSION=1.3.11
ARG PGROONGA_VERSION=4.0.8-1
ARG APPROX_COUNT_COMMIT=341dfa19f73e60d22a8869ccb03bd252d888cec7

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
COPY packages/atlas/package.json packages/atlas/package.json
COPY packages/brand/package.json packages/brand/package.json
COPY services/main/package.json services/main/package.json

FROM ${BUN_IMAGE} AS bun-compiler

ARG BUN_VERSION
USER root

ADD --checksum=sha256:8611ba935af886f05a6f38740a15160326c15e5d5d07adef966130b4493607ed \
    https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-x64.zip \
    /tmp/bun-linux-x64.zip

RUN apt-get update \
	&& apt-get install --yes --no-install-recommends unzip \
	&& unzip /tmp/bun-linux-x64.zip -d /tmp \
	&& install -m 0755 /tmp/bun-linux-x64/bun /usr/local/bin/bun-modern \
	&& rm -rf /tmp/bun-linux-x64 /tmp/bun-linux-x64.zip /var/lib/apt/lists/*

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
COPY packages/atlas /packages/atlas
COPY packages/brand /packages/brand
COPY services/main /services/main

FROM backend-dependency-manifests AS main-dependencies
RUN --mount=type=cache,target=/root/.yarn/berry/cache \
	yarn workspaces focus @rezics/backend --production
COPY --from=backend-source / /workspace/

FROM ${BUN_IMAGE} AS backend-build

ENV DEPLOYMENT_ENVIRONMENT=production \
    HOST=127.0.0.1 \
    NODE_ENV=production \
    PORT=3001 \
    WORKER_HEALTH_HOST=127.0.0.1 \
    WORKER_HEALTH_PORT=3002
WORKDIR /workspace

COPY --from=bun-compiler /usr/local/bin/bun-modern /usr/local/bin/bun-modern
COPY --from=main-dependencies --chown=bun:bun /workspace /workspace

USER bun

FROM backend-build AS api-build

RUN bun-modern build \
	--external=sharp \
	--external=opencc \
	--minify-whitespace \
	--minify-syntax \
	--outdir=/tmp/api \
	--sourcemap=inline \
	--target=bun \
	services/main/src/index.ts

FROM backend-build AS worker-build

RUN bun-modern build \
	--compile \
	--minify-whitespace \
	--minify-syntax \
	--sourcemap \
	--outfile=/tmp/rezics-worker \
	services/main/src/worker.ts

FROM ${BUN_IMAGE} AS api

ENV DEPLOYMENT_ENVIRONMENT=production \
    HOST=127.0.0.1 \
    NODE_ENV=production \
    PORT=3001
WORKDIR /app

COPY --from=bun-compiler /usr/local/bin/bun-modern /usr/local/bin/bun-modern
COPY --from=api-build --chown=bun:bun /tmp/api/index.js /app/rezics-api.js
COPY --from=main-dependencies --chown=bun:bun /workspace/node_modules/@img/colour /app/node_modules/@img/colour
COPY --from=main-dependencies --chown=bun:bun /workspace/node_modules/@img/sharp-libvips-linux-x64 /app/node_modules/@img/sharp-libvips-linux-x64
COPY --from=main-dependencies --chown=bun:bun /workspace/node_modules/@img/sharp-linux-x64 /app/node_modules/@img/sharp-linux-x64
COPY --from=main-dependencies --chown=bun:bun /workspace/node_modules/detect-libc /app/node_modules/detect-libc
COPY --from=main-dependencies --chown=bun:bun /workspace/node_modules/@opencc/opencc-linux-x64 /app/node_modules/@opencc/opencc-linux-x64
COPY --from=main-dependencies --chown=bun:bun /workspace/node_modules/opencc /app/node_modules/opencc
COPY --from=main-dependencies --chown=bun:bun /workspace/node_modules/semver /app/node_modules/semver
COPY --from=main-dependencies --chown=bun:bun /workspace/node_modules/sharp /app/node_modules/sharp

USER bun
EXPOSE 3001
CMD ["/usr/local/bin/bun-modern", "/app/rezics-api.js"]

FROM ${BUN_IMAGE} AS worker

ENV DEPLOYMENT_ENVIRONMENT=production \
    NODE_ENV=production \
    WORKER_HEALTH_HOST=127.0.0.1 \
    WORKER_HEALTH_PORT=3002
WORKDIR /app

COPY --from=worker-build --chown=bun:bun /tmp/rezics-worker /app/rezics-worker

USER bun
EXPOSE 3002
CMD ["/app/rezics-worker"]

FROM backend-dependency-manifests AS database-dependencies
RUN --mount=type=cache,target=/root/.yarn/berry/cache \
	yarn workspaces focus @rezics/backend
COPY --from=backend-source / /workspace/
COPY deploy/scripts/database-operation.sh /workspace/deploy/scripts/database-operation.sh
RUN yarn workspace @rezics/backend exec atlas version

FROM node-tooling AS database

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    DEPLOYMENT_ENVIRONMENT=production \
    NODE_ENV=production
WORKDIR /workspace

COPY --from=database-dependencies --chown=node:node /workspace /workspace

USER node
ENTRYPOINT ["bash", "/workspace/deploy/scripts/database-operation.sh"]

FROM ${POSTGRES_IMAGE} AS postgres

ARG PGROONGA_VERSION
ARG APPROX_COUNT_COMMIT

ADD --checksum=sha256:3406de4b8965c44a0e793090efbb0996a1802930159e7aa3f31c97dbef127c34 \
    https://packages.groonga.org/debian/groonga-apt-source-latest-trixie.deb \
    /tmp/groonga-apt-source.deb

RUN apt-get update \
	&& apt-get install --yes --no-install-recommends ca-certificates git make postgresql-server-dev-18 /tmp/groonga-apt-source.deb \
	&& apt-get update \
	&& apt-get install --yes --no-install-recommends "postgresql-18-pgdg-pgroonga=${PGROONGA_VERSION}" \
	&& git clone --filter=blob:none --no-checkout https://github.com/jmealo/pg_approx_count.git /tmp/pg_approx_count \
	&& git -C /tmp/pg_approx_count checkout "${APPROX_COUNT_COMMIT}" \
	&& test "$(git -C /tmp/pg_approx_count rev-parse HEAD)" = "${APPROX_COUNT_COMMIT}" \
	&& make -C /tmp/pg_approx_count install \
	&& apt-get purge --yes --auto-remove git make postgresql-server-dev-18 \
	&& rm -rf /tmp/groonga-apt-source.deb /tmp/pg_approx_count /var/lib/apt/lists/*

COPY --chmod=0755 services/main/docker/postgres/init /docker-entrypoint-initdb.d

FROM database-dependencies AS postgres-verification-acceptance

RUN yarn workspace @rezics/backend exec tsx scripts/render-search-restore-acceptance.ts \
	> /search-restore-acceptance.sql

FROM postgres AS postgres-verification

RUN mv /usr/lib/postgresql/18/bin/pg_restore /usr/lib/postgresql/18/bin/pg_restore.real

COPY --from=postgres-verification-acceptance /search-restore-acceptance.sql /opt/rezics/search-restore-acceptance.sql
COPY --chmod=0755 services/main/docker/postgres-verification/pg_restore /usr/lib/postgresql/18/bin/pg_restore
