## 1. Docker Compose Topology

- [x] 1.1 Create a unified `tool/external-services` Docker Compose topology for source PostgreSQL, Meilisearch, Sequin state PostgreSQL, Sequin Redis, and Sequin.
- [x] 1.2 Configure managed source PostgreSQL to start with `wal_level=logical`, `max_replication_slots=10`, and `max_wal_senders=10`.
- [x] 1.3 Add source PostgreSQL first-run init scripts that create `rezics_booklib`, `rezics_auth`, `rezics_jobs`, `rezics_history`, `rezics_notify`, and `reaction` local development databases.
- [x] 1.4 Add healthchecks for source PostgreSQL, Meilisearch, Sequin state PostgreSQL, and Sequin.
- [x] 1.5 Wire Sequin to the managed source PostgreSQL service and preserve the existing `package/job-runner/sequin/sequin.yml` config mount.

## 2. Docker-Only Lifecycle Wrapper

- [x] 2.1 Replace the current compose runtime detection with a Docker Compose v2-only check in `tool/external-services`.
- [x] 2.2 Remove Podman, podman-compose, host `host.containers.internal`, and SELinux mount-suffix branches from the managed external-services path.
- [x] 2.3 Implement unified commands for `up`, `down`, `logs`, `ps`, `health`, source verification, and source repair.
- [x] 2.4 Ensure lifecycle commands operate only on the repo Docker Compose project and do not inspect or mutate unrelated user-managed services.
- [x] 2.5 Add clear failure messages for missing Docker Compose v2 and likely host port conflicts.

## 3. Source Verification and Repair

- [x] 3.1 Rename or wrap `tool/db-script/prepare-sequin-source.ts` so the preferred commands distinguish source verification from explicit repair.
- [x] 3.2 Keep check-only verification able to report logical replication settings, tracked tables, publication membership, and replication slot readiness.
- [x] 3.3 Keep repair mode explicit and dev-scoped, including safeguards for active replication slots.
- [ ] 3.4 Validate that source verification succeeds against a fresh managed source PostgreSQL instance without requiring repair.

## 4. Repo Scripts and Environment

- [x] 4.1 Update root `package.json` scripts to expose the unified managed service commands.
- [x] 4.2 Decide whether to retain `service:sequin:*` compatibility aliases and update them to call the unified Docker workflow if retained.
- [x] 4.3 Update `tool/env.ts` and `tool/.env.example` for Docker-only external-service configuration.
- [x] 4.4 Update package env examples where necessary so their local defaults align with the managed Docker service ports and credentials.

## 5. Documentation

- [x] 5.1 Update `tool/README.md` with the Docker Compose v2 managed service workflow and repair-path guidance.
- [x] 5.2 Update `CONTRIBUTING.md` to list Docker Compose v2 as the managed local dependency path.
- [x] 5.3 Document that user-managed services remain manual and are not started, stopped, or repaired by the managed Docker workflow.
- [x] 5.4 Document the fresh-volume happy path and the cases where source repair is appropriate.

## 6. Validation

- [x] 6.1 Run `docker compose config` through the managed wrapper to validate the compose plan.
- [ ] 6.2 Start the managed stack on a fresh Docker volume and verify source PostgreSQL, Meilisearch, and Sequin health.
- [ ] 6.3 Verify source PostgreSQL reports `wal_level=logical`, `max_replication_slots >= 10`, and `max_wal_senders >= 10`.
- [ ] 6.4 Run source verification against the managed source PostgreSQL and confirm publication and replication slot readiness.
- [x] 6.5 Run `bun run check:convention` after script and documentation updates.
