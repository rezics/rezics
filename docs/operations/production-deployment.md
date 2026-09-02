# Production deployment

Production has independent release boundaries:

- `apps/web` is a Vinext Cloudflare Worker on `www.rezics.com`;
- `apps/about` keeps its independent Cloudflare Pages release path;
- the API is a production Elysia/Bun bundle, executed by the pinned Bun runtime
  in a Nomad service that scales from four to eight allocations;
- the background worker is a compiled Bun executable in a separate
  one-allocation Nomad service;
- database migration and derived-data maintenance are separate batch operations;
- stateful PostgreSQL and the Databasus backup manager/verification agent are outside the
  application release graph;
- Outline is an unrelated team service and must not be stopped, migrated,
  reconfigured, or purged by REZICS delivery.

The sibling `../nixos` repository owns the host, Cloudflare Tunnel origins,
Nomad ACLs, release gateway, fixed production jobspecs, and release parent jobs.
Cloudflare Tunnel is the only public ingress to host services.

## GitHub boundary

`Check` runs on GitHub-hosted runners for pull requests and `main`. It is an
advisory diagnostic signal: its result never gates merge, tag creation, GitHub
Release publication, or production dispatch. Fix deterministic failures when
they are found, but do not couple deployment availability to Check.

A stable `vMAJOR.MINOR.PATCH` tag starts the server `release.yml` workflow. That
workflow:

1. passes the protected `production` GitHub environment before the job starts;
2. obtains a short-lived GitHub OIDC JWT for audience
   `rezics-nomad-release`;
3. sends one empty authenticated POST to
   `https://deploy.rezics.com/v1/releases/dispatch`;
4. requires a matching `202 Accepted` receipt containing the tag ref, commit,
   dispatched job ID, and evaluation ID;
5. prints the Nomad UI link for that dispatched job;
6. creates the GitHub Release for the tag. The Release means the gateway
   accepted and dispatched this immutable tag. Production success or failure
   is observed in the Nomad UI at `https://nomad.rezics.com/ui/jobs`.

The Web Worker has a separate GitHub-owned release boundary. A `web/v*` tag or
an explicit manual dispatch starts `deploy-web-cloudflare.yml`, which builds and
promotes the Worker with the protected GitHub `production` environment. It does
not enter the Nomad server release graph.

The public TypeScript client has another independent boundary. An
`api/vMAJOR.MINOR.PATCH` tag must match `packages/api/package.json`; the
`publish-api.yml` workflow regenerates and verifies the client, runs its type,
test, build, and package-content checks, and then publishes `@rezics/api` through
npm Trusted Publishing. No npm token is stored in GitHub. Before the first run,
the npm package owner must configure the trusted publisher for repository
`rezics/rezics`, workflow `publish-api.yml`, and GitHub environment
`production`.

The gateway validates the immutable repository and owner IDs, workflow ref,
GitHub-hosted runner, `production` environment, stable tag, commit, issuer, and
audience. Nomad independently requires the mapped `production` environment
claim before granting the server workflow a five-minute token with only
`dispatch-job` in `rezics-release`. The server workflow receives no server
login, SSH credential, Nomad token, database secret, Cloudflare token, or
registry credential; the separate Web workflow receives only its scoped
Cloudflare deployment secrets from GitHub's protected environment.

## Server release graph

The fixed `rezics-release` controller verifies that the tagged commit matches
the dispatch identity and is reachable from `main`. It calculates deterministic
input hashes from `deploy/release/components.json` and compares them with the
last successful per-component state. Re-dispatching the same tag and commit
skips completed components and retries only incomplete work.

The dependency order is:

1. rootless builder exports Docker image archives for changed database, API, and worker
   targets;
2. controller imports those archives into the internal WireGuard registry and resolves
   immutable digest references;
3. for a release listed in `maintenanceCutovers`, the fixed maintenance job
   verifies the low-priority HTTP 503 fallback and stops worker then API;
4. database preflight, migration, privilege reconciliation, identity ensure, and verification;
5. independent API and worker rollouts, which automatically shadow the fallback
   again after API readiness succeeds;
6. explicit derived-data maintenance and PGroonga index health verification.

Unchanged components are skipped. A database change conservatively invalidates
API, worker, and derived-data maintenance. API and worker have separate images and separate
Nomad deployments. Web is independent of this graph. The controller waits for
each batch child through Nomad's allocation event stream. API and worker leaf
deploys use Nomad's native `job run -verbose` monitor. Watch the parent
`rezics-release` dispatch, its child jobs in the `rezics-release` namespace,
and the `rezics-api` / `rezics-worker` deployments in the Nomad UI. GitHub
Actions does not follow Nomad output after dispatch.

Nomad's canary, auto-promotion, and automatic-revert behavior follows the
[Nomad update specification](https://developer.hashicorp.com/nomad/docs/job-specification/update).
The host-managed Nomad Autoscaler evaluates the API's average percentage of
allocated CPU every 15 seconds, targets 65%, and observes a one-minute cooldown.
It can add at most two allocations or remove at most one allocation per
evaluation, while Traefik's watched Nomad catalog routes traffic to the healthy
allocation set. The scaler cannot exceed the jobspec's four-to-eight bounds.
Cloudflare pre-traffic verification uses
[Worker version overrides](https://developers.cloudflare.com/workers/versions-and-deployments/version-overrides/).

## Privilege boundaries

The release controller can dispatch fixed jobs in `rezics-release`; it cannot
submit jobs in the production `rezics` namespace. The rootless builder receives
only its own Docker socket and a writable copy of the tagged source. It never
receives Nomad credentials, the host Docker socket, or the Nix daemon socket.
The controller executes only its separate root-owned source copy.

API and worker rollouts use pre-registered deploy jobs. Their constrained tasks
run as `rezics-deploy`, reject anything except the matching
`${REZICS_REGISTRY:-10.64.0.1:5000}/rezics-<component>@sha256:<digest>` form, and can apply only the
fixed jobspecs installed by NixOS. The production deploy token is never mounted
in an application or build container.

Nomad Variables are encrypted in Nomad state. Workload-associated policies
expose only:

| Namespace               | Path                                    | Consumer                          |
| ----------------------- | --------------------------------------- | --------------------------------- |
| `rezics`                | `application/runtime`                   | API and worker runtime tasks      |
| `rezics`                | `database/operations`                   | root/operator installation source |
| `rezics-release`        | `release/database`                      | database and maintenance tasks    |
| `rezics-infrastructure` | `database/databasus-control`            | Databasus master key only         |
| `rezics-infrastructure` | `database/databasus-source`             | one-time source/R2 setup          |
| `rezics-infrastructure` | `database/databasus-verification-agent` | restore agent only                |

The reconciler copies the existing `database/operations` items into
`release/database` without printing them. API and worker receive
`DATABASE_URL`, never `DATABASE_ADMIN_URL`. Only the database/maintenance tasks
receive the administrative connection. The Web workflow receives its scoped
Cloudflare deployment secrets from GitHub's protected environment; they are not
copied into NixOS or Nomad. Backup credentials belong to a dedicated private R2
bucket and are never copied into an application or release Variable.

See the [Nomad Variables access model](https://developer.hashicorp.com/nomad/docs/concepts/variables)
and [workload identity model](https://developer.hashicorp.com/nomad/docs/concepts/workload-identity).

## Database rules

Each API or worker process owns a six-connection `node-postgres` pool. Eight API
allocations plus the worker therefore admit at most 54 application connections;
the ninth temporary API canary raises that bound to 60. PostgreSQL keeps
`max_connections = 120`, with ten reserved connections and another three
superuser-reserved connections, leaving 107 ordinary slots and 47 ordinary
slots beyond the worst direct-connection application rollout. Increase the
autoscaling maximum only after checking PostgreSQL connection headroom and the
application pool waiting metric.

The NixOS repository is the source of truth for the PostgreSQL, PgBouncer, and
Databasus Nomad jobs. PostgreSQL receives 24,000 MHz, a 24 GiB soft memory
reservation, a 45 GiB hard limit, and a 12 GiB shared buffer cache. PgBouncer
admits at most 512 clients but caps the transaction database at 48 server
connections and the explicit session database at four. It is initially deployed
without changing `application/runtime`: API and worker continue to use B port
5432 until a separately verified application cutover moves eligible traffic to
port 6432.

These stateful jobs remain outside the application release graph. Activate and
verify the sibling NixOS revision before a release that depends on new database
resource settings; a normal stable application tag does not mutate them. Nomad
sends `SIGINT` for PostgreSQL's fast shutdown mode so persistent application
pools cannot turn a graceful rollout into a forced `SIGKILL` after the task
timeout.

`deploy/scripts/database-operation.sh release` runs preflight, migration,
identity ensure, and verification in one serialized batch job. It asserts that both administrative
and runtime URLs target the REZICS production database before doing any work.
Migration files normally follow expand/contract delivery: deploy
backward-compatible structures first, then clean up only after the old
application can no longer run. A release that intentionally changes the
persisted contract may instead be listed in `maintenanceCutovers`. For that
release, all replacement images must be available before the controller stops
writers and public API traffic, and only the new jobs may resume after migration
verification. Database migrations are forward operations and are not
automatically reversed.

Corpus-scale `CHECK` constraints follow the staged procedure in
[Data integrity and workload budgets](../architecture/data-integrity-and-workload-budgets.md#constraint-rollout).
An `ADD CONSTRAINT ... NOT VALID` migration protects new writes but does not
authorize the release job to scan historical tables. Operators inspect staged
state and validate one allowlisted constraint at a time after checking I/O,
replica lag, and lock headroom. Unvalidated historical state is an explicit
operational item, not a reason to hide validation inside application startup.

`v1.3.0` uses this explicit cutover because it deletes four non-core,
recomputable recommendation projection tables and replaces the sparse ranking
function/index contract. Its DDL runs in one transaction while writers are
stopped, and the release verifies the canonical PGroonga indexes before it
restores API traffic. If the migration or verification fails, API and worker
remain stopped and the fallback continues returning 503. A transaction failure
rolls back the whole migration; otherwise repair forward and retry incomplete
components. Restore the pre-cutover backup with the 1.2.0 binaries only before
any 1.3.0 traffic has resumed; after resumption, repair forward.

For the 1.3.0 release, activate the sibling NixOS revision and verify the
maintenance fallback and all seven release jobs first. Then create the
`v1.3.0` tag from `main`, observe the server release to completion in Nomad, and
only then create `api/v1.7.0` from the same application commit. Confirm the npm
package before announcing the public client update.

Derived-data maintenance is a distinct job so it is independently observable and resumable.
If database work fails, API, worker, and maintenance do not run.
Outline uses its existing independent database configuration and is never part
of these operations.

### v1.0.0 baseline installation

The `20260801000000_v1_baseline.sql` migration is the first supported database
contract and is intentionally install-only. Databases created during the
pre-release test period are not upgrade sources: archive any evidence that must
be retained, stop application writers, and recreate the REZICS
database before installing v1.0.0. Do not dispatch the routine rolling release
graph against a database that recorded an earlier checksum for this baseline.

For the v1.0.0 cutover, activate the sibling NixOS revision first and wait for
the `rezics-database-reconcile` service, PostgreSQL, PgBouncer, and pinned
Databasus readiness, then use
`bootstrap-production.sh --confirm-empty-database`.
The bootstrap installs the database, verifies PostgreSQL 18.4, PGroonga 4.0.8,
`approx_count` 1.0, the required preload settings and canonical indexes, and only then starts API
and worker traffic. No v1 workload owns a logical CDC slot. Databasus owns the backup schedule,
R2 transfer, GFS retention, catalog, notification, and weekly isolated restore; its separately
provisioned verification identity is consumed by the NixOS-managed agent using the REZICS
PostgreSQL 18 verification image.

## Cloudflare Worker release

The GitHub Web workflow installs the repository-pinned Yarn version, verifies
generated offline and Cloudflare binding artifacts, builds the Worker, and uploads a new
version. When production already exists, it stages the new version at 0%, waits
for a bounded series of version-override probes to pass, promotes it to 100%,
and waits for a bounded series of production probes to pass. These retries
allow the new deployment to become globally available without weakening the
verification or exposing unverified traffic. The probes also verify the
Font Awesome marker and
`https://fa.rezics.com/fontawesome/7.2.0/css/rezics.min.css` reference. A failed
probe restores the previously recorded 100% version.

`rezics.com` should redirect to canonical `https://www.rezics.com`; the Worker
and API hostnames remain separate origins.

## Operations and rollback

Apply NixOS changes before moving a server application tag that depends on them.
A host activation reconciles OIDC, workload policies, protected Variables, and
the fixed server release parent jobs. For 1.3.0, activation must also install and
health-check the always-on maintenance fallback and register the fixed
maintenance batch before the tag is created. It also installs the Nomad Autoscaler and
its long-lived client token whose sole policy is `scale` in the `rezics`
namespace. The Nomad client reserves 2,000 MHz and 2 GiB for the host and
control-plane services. Verify the autoscaler health endpoint on
`127.0.0.1:15001`, the gateway health endpoint,
rootless Docker daemon, internal registry, Nomad client drivers, and Outline
allocation before dispatching the application release. When upgrading an
installation that still has the retired `rezics-release-web` parent, first
verify that no Web child allocation is running, then deregister that parent,
purge its obsolete `release/config` Variable, and remove its old workload ACL
policy; subsequent activations no longer recreate any of them. The exact
one-time cleanup is:

```sh
rezics-nomad-operator job stop -namespace=rezics-release -purge -yes rezics-release-web
rezics-nomad-operator var purge -namespace=rezics-release release/config
rezics-nomad-operator acl policy delete rezics-release-web-variable
```

Application rollback uses a previously recorded API/worker digest and a prior
Cloudflare Worker version. Never reverse a successful database migration merely
to roll back application code. If a migration fails, repair forward before
restarting release.

The current installation is a single host and is not highly available. PostgreSQL has a
Databasus-managed daily complete logical backup and weekly complete isolated restore documented in
[PostgreSQL backup and recovery](./postgresql-backup-recovery.md); v1 deliberately makes no PITR
claim. Outline data preservation means leaving its existing allocation,
database, volumes, and object storage untouched; it does not authorize deleting
or recreating them.
