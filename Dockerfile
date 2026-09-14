# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:26-bookworm-slim@sha256:367679cf9792759492a486e4aa4b421764d71a9546a6dae8aab81a99eb797b3e
ARG BUN_IMAGE=oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61
ARG POSTGRES_IMAGE=postgres:18.6-trixie@sha256:4ef4dbc939d61acea57712655ddb4b4ab27419c913f94cca0cd57cb3ea3c2280
ARG COREPACK_VERSION=0.36.0
ARG BUN_VERSION=1.4.2
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
COPY .yarn/releases/yarn-4.18.0.cjs .yarn/releases/yarn-4.18.0.cjs
COPY .yarn/patches .yarn/patches
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

ADD --checksum=sha256:36368faef7527875d5ffa52e53cd48021741f2a83eb6208a8dd64068d422a913 \
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

# PGDG's live repository retires older minor releases. Resolve build dependencies
# from its signed archive and keep server/client/JIT aligned with the pinned base.
RUN printf 'deb [signed-by=/usr/local/share/keyrings/postgres.gpg.asc] https://apt-archive.postgresql.org/pub/repos/apt trixie-pgdg-archive main %s\n' "${PG_MAJOR}" > /etc/apt/sources.list.d/pgdg-archive.list \
	&& printf 'Package: postgresql-%s postgresql-client-%s postgresql-server-dev-%s postgresql-%s-jit\nPin: version %s\nPin-Priority: 1001\n' "${PG_MAJOR}" "${PG_MAJOR}" "${PG_MAJOR}" "${PG_MAJOR}" "${PG_VERSION}" > /etc/apt/preferences.d/rezics-postgres \
	&& apt-get update \
	&& apt-get install --yes --no-install-recommends ca-certificates git make "postgresql-server-dev-${PG_MAJOR}=${PG_VERSION}" /tmp/groonga-apt-source.deb \
	&& apt-get update \
	&& apt-get install --yes --no-install-recommends "postgresql-18-pgdg-pgroonga=${PGROONGA_VERSION}" \
	&& git clone --filter=blob:none --no-checkout https://github.com/jmealo/pg_approx_count.git /tmp/pg_approx_count \
	&& git -C /tmp/pg_approx_count checkout "${APPROX_COUNT_COMMIT}" \
	&& test "$(git -C /tmp/pg_approx_count rev-parse HEAD)" = "${APPROX_COUNT_COMMIT}" \
	&& make -C /tmp/pg_approx_count install \
	&& apt-get purge --yes --auto-remove git make postgresql-server-dev-18 \
	&& test "$(dpkg-query -W -f='${Version}' postgresql-${PG_MAJOR})" = "${PG_VERSION}" \
	&& test "$(dpkg-query -W -f='${Version}' postgresql-client-${PG_MAJOR})" = "${PG_VERSION}" \
	&& rm -rf /tmp/groonga-apt-source.deb /tmp/pg_approx_count /var/lib/apt/lists/*

COPY --chmod=0755 services/main/docker/postgres/init /docker-entrypoint-initdb.d

FROM database-dependencies AS postgres-verification-acceptance

RUN yarn workspace @rezics/backend exec tsx scripts/render-search-restore-acceptance.ts \
	> /search-restore-acceptance.sql

FROM postgres AS postgres-verification

RUN mv /usr/lib/postgresql/18/bin/pg_restore /usr/lib/postgresql/18/bin/pg_restore.real

COPY --from=postgres-verification-acceptance /search-restore-acceptance.sql /opt/rezics/search-restore-acceptance.sql
COPY --chmod=0755 services/main/docker/postgres-verification/pg_restore /usr/lib/postgresql/18/bin/pg_restore
