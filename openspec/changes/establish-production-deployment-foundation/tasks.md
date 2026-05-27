## 1. Runtime Inventory

- [ ] 1.1 Inventory production runtime packages in `package/*/package.json`, classify each package as static frontend, backend HTTP service, worker service, migration owner, or library-only.
- [ ] 1.2 Document service ports, required env variables, health endpoints, Prisma schema ownership, and external dependencies for `package/server`, `package/auth`, `package/notify`, `package/reaction`, `package/history`, `package/job-runner`, and `package/preview`.
- [ ] 1.3 Decide and document whether `package/preview` is a production backend service or non-production tooling.
- [ ] 1.4 Identify current gaps in production health endpoints and graceful shutdown behavior for each backend runtime service.

## 2. Backend Build and Runtime Entry Points

- [ ] 2.1 Standardize production cluster entrypoints for Elysia HTTP services in `package/server`, `package/auth`, `package/notify`, `package/reaction`, `package/history`, and any production `package/preview` service.
- [ ] 2.2 Add configurable worker-count handling for Elysia cluster entrypoints with documented defaults and signal handling.
- [ ] 2.3 Keep `package/job-runner` HTTP and worker roles separate; add or adjust entrypoints so HTTP can use HTTP deployment semantics while worker concurrency remains explicit.
- [ ] 2.4 Ensure each backend runtime package has a `build:linux` or equivalent production build script that produces the correct compiled Linux artifact.
- [ ] 2.5 Verify compiled binaries can start with minimal production-like env and expose their health behavior.

## 3. Docker Images

- [ ] 3.1 Add shared Docker build conventions for Bun workspace installs, package-focused builds, compiled artifacts, non-root runtime users, and small runtime images.
- [ ] 3.2 Add production Docker image definitions for `package/server`, `package/auth`, `package/notify`, `package/reaction`, `package/history`, `package/job-runner`, and any production `package/preview` service.
- [ ] 3.3 Ensure Prisma generated clients, migration files, schema files, and runtime assets required by compiled services are included in the relevant images.
- [ ] 3.4 Add Docker healthchecks or compose-level healthchecks for each runtime service image.
- [ ] 3.5 Build all backend images locally or in CI and verify each image starts far enough to run its healthcheck with test env.

## 4. Production Deployment Units

- [ ] 4.1 Introduce deployment assets for separate production units: database infrastructure, search infrastructure, CDC infrastructure, proxy, backend HTTP services, workers, and migrations.
- [ ] 4.2 Configure deployment units with independent compose project names, env files, volume/state locations, healthchecks, logs, and update commands.
- [ ] 4.3 Use explicit service endpoints in env/config so same-host placement does not rely on a monolithic compose network.
- [ ] 4.4 Add backend HTTP service deployment definitions for `server`, `auth`, `notify`, `reaction`, `history`, and any production `preview` service.
- [ ] 4.5 Add worker deployment definitions for `job-runner-worker` separately from `job-runner-http`.
- [ ] 4.6 Add proxy deployment definitions and routing assumptions for public API, auth, notify/reaction/history endpoints as applicable.

## 5. Migration Jobs

- [ ] 5.1 Add one-shot migration job definitions for `package/auth`, `package/server`, `package/notify`, `package/reaction`, and `package/history`.
- [ ] 5.2 Add job database preparation or schema validation tasks for `package/job-runner`.
- [ ] 5.3 Ensure migration jobs run from the target image revision and fail before runtime service rollout on error.
- [ ] 5.4 Document migration order, forward-compatibility expectations, and rollback limitations.

## 6. Env and Secret Management

- [ ] 6.1 Add production env schema documentation or machine-readable manifests per deployment unit.
- [ ] 6.2 Classify env values as secret or non-secret and document the owner/source for each value.
- [ ] 6.3 Add an encrypted env workflow or secret-manager integration for production values.
- [ ] 6.4 Add validation commands that fail deployment before mutating services when required env values are missing.
- [ ] 6.5 Document bootstrap, rotation, and break-glass recovery for production secrets.

## 7. Release Automation

- [ ] 7.1 Add CI workflow steps for Bun install, repo checks, targeted tests, and backend production builds.
- [ ] 7.2 Add CI workflow steps to build and publish backend images with immutable git SHA tags.
- [ ] 7.3 Add deployment workflow steps for targeted backend HTTP service rollout, health verification, and rollback by previous image tag.
- [ ] 7.4 Add deployment workflow steps for worker rollout and scaling independent from backend HTTP services.
- [ ] 7.5 Add explicit manual or separately approved workflows for infrastructure unit changes.
- [ ] 7.6 Ensure release logs clearly show image tags, migration status, rollout targets, and healthcheck results.

## 8. Cloudflare Static Frontends

- [ ] 8.1 Add Cloudflare deployment configuration for `package/app` static Vite output.
- [ ] 8.2 Add Cloudflare deployment configuration for `package/admin` static Vite output.
- [ ] 8.3 Define production frontend env variables for API, auth, reaction, notify, and any other service endpoints consumed by `package/app` and `package/admin`.
- [ ] 8.4 Add release workflow steps to build and deploy `package/app` and `package/admin` without Docker images.
- [ ] 8.5 Verify generated static outputs do not require SSR runtime services.

## 9. Local External Services Boundary

- [ ] 9.1 Update `tool/external-services` documentation to state that the compose project is local-development only.
- [ ] 9.2 Ensure production deployment docs do not reference `tool/external-services/compose.yml` as a production deployment plan.
- [ ] 9.3 Preserve existing local external-services commands and validate they still start, stop, report health, and stream logs for development.

## 10. Operations Documentation

- [ ] 10.1 Add production bootstrap runbook covering host preparation, registry access, secret access, external networks, volumes, proxy, and infrastructure units.
- [ ] 10.2 Add release runbook covering backend image promotion, migration jobs, service rollout, Cloudflare deployment, and health checks.
- [ ] 10.3 Add rollback runbook covering Cloudflare rollback, backend image rollback, worker rollback, infrastructure rollback boundaries, and migration caveats.
- [ ] 10.4 Add troubleshooting runbook for logs, failed healthchecks, migration failures, proxy routing, CDC delivery, and worker queue readiness.
- [ ] 10.5 Cross-link production deployment docs from the repo developer/deployment documentation.

## 11. Validation

- [ ] 11.1 Run `bun run format:check` after adding deployment source files and documentation.
- [ ] 11.2 Run `bun run check:convention` and resolve any convention violations from new deployment assets.
- [ ] 11.3 Run backend production build commands for all Dockerized runtime services.
- [ ] 11.4 Run Docker build validation for all backend runtime images.
- [ ] 11.5 Run deployment manifest rendering or compose config validation for each production deployment unit.
- [ ] 11.6 Run Cloudflare frontend build validation for `package/app` and `package/admin`.
- [ ] 11.7 Run OpenSpec validation/status checks for this change before implementation is considered complete.
