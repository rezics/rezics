## 1. Runtime Inventory

- [x] 1.1 Inventory production runtime packages in `package/*/package.json`, classify each package as static frontend, backend HTTP service, worker role, migration owner, or library-only.
- [x] 1.2 Document service ports, required env variables, health endpoints, Prisma schema ownership, and external dependencies for `package/server`, `package/auth`, `package/notify`, `package/reaction`, `package/history`, `package/job-runner`, and `package/ranking`.
- [x] 1.3 Document the shared observability env contract from `@rezics/shared` (`OBSERVABILITY_LOG_FORMAT`, `OBSERVABILITY_COLOR`, `OBSERVABILITY_SLOW_REQUEST_MS`, `OBSERVABILITY_TELEMETRY`, `OTEL_EXPORTER_OTLP_ENDPOINT`) as required per-service production values.
- [x] 1.4 Record `package/preview` as non-production tooling, excluded from the first production service set.
- [x] 1.5 Identify current gaps in production health/readiness endpoints and graceful shutdown for each backend runtime service (note: only `ranking` exposes `/ranking/ready` today).

## 2. Backend Build and Runtime Entry Points

- [ ] 2.1 Standardize production cluster entrypoints for Elysia HTTP services in `package/server`, `package/auth`, `package/notify`, `package/reaction`, `package/history`, and `package/ranking` (ranking currently only calls `app.listen`).
- [ ] 2.2 Add configurable worker-count handling (`WORKERS`) for Elysia cluster entrypoints with documented defaults and signal handling, using `@rezics/shared` observability helpers for startup/log output.
- [ ] 2.3 Keep `package/job-runner` HTTP and worker roles separate; ensure `job-runner-http` uses HTTP semantics while `job-runner-worker` concurrency stays explicit.
- [ ] 2.4 Define a dedicated `ranking-worker` role that consumes the ranking job lane, separate from `job-runner-worker`, with explicit replica/concurrency controls.
- [ ] 2.5 Ensure each backend runtime package has a `build:linux` (or equivalent) production build script producing the correct compiled Linux artifact (target amd64).
- [ ] 2.6 Verify compiled binaries start with minimal production-like env and expose health/readiness behavior; add `/health` + `/ready` where missing.

## 3. Docker Images

- [ ] 3.1 Add a shared multi-stage base image for Bun workspace install, with build context at the repo root and aggressive `.dockerignore`.
- [ ] 3.2 Add thin per-service Dockerfiles for `server`, `auth`, `notify`, `reaction`, `history`, `job-runner`, and `ranking` that compile and package only their artifact.
- [ ] 3.3 Encode the Bun + Prisma constraints: run `prisma generate` in a Node-capable stage, supply a dummy `DATABASE_URL` at build (never a real secret), `bun install --ignore-scripts`, and copy the generated Prisma client + query engine into the runtime image.
- [ ] 3.4 Ensure ranking's image includes `@rezics/server`'s generated Prisma client (main-DB read) and that all images run as a non-root user on a slim/distroless runtime.
- [ ] 3.5 Add image healthchecks for each runtime service.
- [ ] 3.6 Build all backend images in CI and verify each starts far enough to pass its healthcheck with test env.

## 4. Deployment Units and Kamal Orchestration

- [ ] 4.1 Adopt Kamal as the deployment orchestrator; add base Kamal configuration targeting GHCR images and SSH access to the production host.
- [ ] 4.2 Define deployment units at per-service granularity: `infra-db`, `infra-search`, `infra-cdc`, `infra-observability` (opt-in), `proxy` (kamal-proxy), each services-api service, each worker role, and migration jobs.
- [ ] 4.3 Configure each unit with explicit service endpoints in env/config so same-host placement does not rely on a monolithic compose network.
- [ ] 4.4 Add Kamal app/role definitions for backend HTTP services `server`, `auth`, `notify`, `reaction`, `history`, and `ranking` (ranking internal-only: no public proxy route, no public CORS).
- [ ] 4.5 Add worker role definitions for `job-runner-worker` and `ranking-worker`, scalable independently from HTTP services.
- [ ] 4.6 Configure `kamal-proxy` for TLS and health-gated zero-downtime swaps; define public vs internal routing (server/auth public, notify/reaction/history proxied, ranking + workers internal).
- [ ] 4.7 Configure `infra-cdc` (Sequin) for two source databases — main and reaction — with their publications, and document replication-slot lag monitoring.
- [ ] 4.8 Define the top-level deploy sequence (infra → migrations → services → workers) and confirm a single invocation strings the units together in dependency order.

## 5. Migration Jobs

- [ ] 5.1 Add one-shot migration job definitions for `package/auth`, `package/server`, `package/notify`, `package/reaction`, `package/history`, and `package/ranking`.
- [ ] 5.2 Add job database preparation/schema validation for `package/job-runner`.
- [ ] 5.3 Ensure migration jobs run from the target image revision and fail before runtime service rollout on error.
- [ ] 5.4 Add a one-shot ranking Meili backfill/full-sync step that runs after ranking-relevant schema or index-settings changes.
- [ ] 5.5 Document migration order, forward-compatibility expectations, and rollback limitations (ranking recovers by recompute, not DB restore).

## 6. Env and Secret Management

- [ ] 6.1 Add per-deployment-unit env schemas listing required values, defaults, owners, and secret/non-secret classification (including the shared observability contract).
- [ ] 6.2 Set up SOPS + age: encrypted per-unit env files committed to the repo, decrypted at deploy with an age key held by the CI runner/host, surfaced to Kamal as its secrets source.
- [ ] 6.3 Keep frontend public config (`VITE_*`) as build-time Cloudflare variables; ensure no secrets are baked into static assets.
- [ ] 6.4 Add validation that fails deployment before mutating services when required env values are missing.
- [ ] 6.5 Document age-key bootstrap, rotation, and break-glass recovery.

## 7. Release Automation

- [ ] 7.1 Add CI steps for Bun install, repo checks, targeted tests, and backend production builds.
- [ ] 7.2 Add CI steps to build and publish backend images to GHCR with immutable git-SHA tags; trigger image builds on push to `dev`.
- [ ] 7.3 Add a production deploy workflow that runs `kamal deploy` behind a GitHub Environment approval (manual/tag-gated dispatch), with health verification and rollback by previous image tag.
- [ ] 7.4 Add worker rollout/scaling for `job-runner-worker` and `ranking-worker` independent from backend HTTP services.
- [ ] 7.5 Add explicit manual or separately approved targets for infrastructure and `infra-observability` unit changes.
- [ ] 7.6 Ensure release logs show image tags, migration status, rollout targets, and healthcheck results.

## 8. Cloudflare Static Frontends

- [ ] 8.1 Add Cloudflare deployment configuration for `package/app` static Vite output.
- [ ] 8.2 Add Cloudflare deployment configuration for `package/admin` static Vite output.
- [ ] 8.3 Define production frontend env (`VITE_*`) for API, auth, reaction, and notify endpoints consumed by `package/app` and `package/admin` (ranking is internal-only and not a frontend endpoint).
- [ ] 8.4 Add release workflow steps to build and deploy both frontends without Docker images.
- [ ] 8.5 Verify generated static outputs do not require SSR runtime services, and document the backend-before-frontend deploy order for contract forward-compatibility.

## 9. Local External Services Boundary

- [ ] 9.1 Update `tool/external-services` documentation to state the compose project is local-development only.
- [ ] 9.2 Ensure production deployment docs do not reference `tool/external-services/compose.yml` (or its local `otel-collector.yml`) as a production deployment plan.
- [ ] 9.3 Re-baseline this change's `external-services-docker` delta against the now-applied `standardize-elysia-observability` change (pinned image baselines, local OTel Collector, reaction DB source) so the spec does not regress.
- [ ] 9.4 Preserve existing local external-services commands and validate they still start, stop, report health, and stream logs for development.

## 10. Operations Documentation

- [ ] 10.1 Add a production bootstrap runbook: host prep, GHCR credentials, age key, PostgreSQL instance + per-service databases, Meili, Sequin (two sources), kamal-proxy, and the opt-in observability unit.
- [ ] 10.2 Add a release runbook: image promotion, migration jobs, `kamal deploy` rollout, ranking Meili backfill, Cloudflare deployment, and health checks.
- [ ] 10.3 Add a rollback runbook: Cloudflare rollback, Kamal image rollback, worker rollback, infrastructure rollback boundaries, and ranking recompute recovery.
- [ ] 10.4 Add a troubleshooting runbook: logs (JSON + OTLP), failed healthchecks, migration failures, proxy routing, replication-slot lag for both CDC sources, and worker queue readiness.
- [ ] 10.5 Cross-link production deployment docs from the repo developer/deployment documentation.

## 11. Validation

- [ ] 11.1 Run `bun run format:check` after adding deployment source files and documentation.
- [ ] 11.2 Run `bun run check:convention` and resolve violations from new deployment assets.
- [ ] 11.3 Run backend production build commands for all Dockerized runtime services (incl. ranking).
- [ ] 11.4 Run Docker build validation for the shared base and all per-service images.
- [ ] 11.5 Validate Kamal configuration rendering and per-unit env validation for each deployment unit.
- [ ] 11.6 Run Cloudflare frontend build validation for `package/app` and `package/admin`.
- [ ] 11.7 Run OpenSpec validation/status checks for this change before implementation is considered complete.
