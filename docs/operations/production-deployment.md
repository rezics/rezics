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
5. creates the GitHub Release if it does not already exist;
6. exits without polling, streaming logs, or deciding server deployment success.

The Web Worker has a separate GitHub-owned release boundary. A `web/v*` tag or
an explicit manual dispatch starts `deploy-web-cloudflare.yml`, which builds and
promotes the Worker with the protected GitHub `production` environment. It does
not enter the Nomad server release graph.

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
2. controller imports those archives into the loopback registry and resolves
   immutable digest references;
3. database preflight, migration, privilege reconciliation, and verification;
4. independent API and worker rollouts;
5. explicit derived-data maintenance and PGroonga index health verification.

Unchanged components are skipped. A database change conservatively invalidates
API, worker, and derived-data maintenance. API and worker have separate images and separate
Nomad deployments. Web is independent of this graph. The controller and fixed
service deploy runners follow Nomad event streams at dependency edges; there is
no interval polling loop.

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

API and worker rollouts use pre-registered deploy jobs. Their host `exec` tasks
run as `rezics-deploy`, reject anything except the matching
`127.0.0.1:5000/rezics-<component>@sha256:<digest>` form, and can apply only the
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
`max_connections = 100`, of which three are reserved for superusers, leaving 37
ordinary slots beyond the worst application rollout. Increase the autoscaling
maximum only after checking both PostgreSQL connection headroom and the
application's pool waiting metric.

The stateful PostgreSQL jobspec allocates 4,000 MHz and 8 GiB, including a 2 GiB
shared buffer cache and settings sized for the host. It remains outside the
application release graph. Apply and verify that jobspec before a release that
depends on new database resource settings; a normal stable application tag does
not mutate the stateful job.

`deploy/scripts/database-operation.sh release` runs preflight, migration, and
verification in one serialized batch job. It asserts that both administrative
and runtime URLs target the REZICS production database before doing any work.
Migration files must follow expand/contract delivery: deploy backward-compatible
structures first; destructive cleanup belongs in a later release after the old
application version can no longer run. Database migrations are forward
operations and are not automatically reversed.

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

For the v1.0.0 cutover, apply the stateful PostgreSQL jobspec first and wait for
PostgreSQL and pinned Databasus readiness, then use
`bootstrap-production.sh --confirm-empty-database`.
The bootstrap installs the database, verifies PostgreSQL 18.4, PGroonga 4.0.8,
`approx_count` 1.0, the required preload settings and canonical indexes, and only then starts API
and worker traffic. No v1 workload owns a logical CDC slot. Databasus owns the backup schedule,
R2 transfer, GFS retention, catalog, notification, and weekly isolated restore; its separately
installed verification agent uses the REZICS PostgreSQL 18 image.

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
the fixed server release parent jobs. It also installs the Nomad Autoscaler and
its long-lived client token whose sole policy is `scale` in the `rezics`
namespace. The Nomad client reserves 2,000 MHz and 2 GiB for the host and
control-plane services. Verify the autoscaler health endpoint on
`127.0.0.1:15001`, the gateway health endpoint,
rootless Docker daemon, loopback registry, Nomad client drivers, and Outline
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
