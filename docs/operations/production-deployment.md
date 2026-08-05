# Production deployment

Production has independent release boundaries:

- `apps/web` is a Vinext Cloudflare Worker on `www.rezics.com`;
- `apps/about` keeps its independent Cloudflare Pages release path;
- the API is a two-allocation Nomad service;
- the background worker is a separate one-allocation Nomad service;
- database migration and derived-data maintenance are separate batch operations;
- stateful PostgreSQL and its scheduled logical-backup/restore-drill jobs are outside the
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

A stable `vMAJOR.MINOR.PATCH` tag starts `release.yml`. The workflow:

1. passes the protected `production` GitHub environment before the job starts;
2. obtains a short-lived GitHub OIDC JWT for audience
   `rezics-nomad-release`;
3. sends one empty authenticated POST to
   `https://deploy.rezics.com/v1/releases/dispatch`;
4. requires a matching `202 Accepted` receipt containing the tag ref, commit,
   dispatched job ID, and evaluation ID;
5. creates the GitHub Release if it does not already exist;
6. exits without polling, streaming logs, or deciding deployment success.

The gateway validates the immutable repository and owner IDs, workflow ref,
GitHub-hosted runner, `production` environment, stable tag, commit, issuer, and
audience. Nomad independently requires the mapped `production` environment
claim before granting the workflow a five-minute token with only `dispatch-job`
in `rezics-release`. GitHub receives no server login, SSH credential, Nomad
token, database secret, Cloudflare token, or registry credential.

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
5. explicit derived-data maintenance and PGroonga index health verification;
6. web build, Cloudflare version-override verification, and promotion.

Unchanged components are skipped. A database change conservatively invalidates
API, worker, and projection. API and worker have separate images and separate
Nomad deployments. The controller and fixed service deploy runners follow
Nomad event streams at dependency edges; there is no interval polling loop.

Nomad's canary, auto-promotion, and automatic-revert behavior follows the
[Nomad update specification](https://developer.hashicorp.com/nomad/docs/job-specification/update).
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

| Namespace               | Path                       | Consumer                          |
| ----------------------- | -------------------------- | --------------------------------- |
| `rezics`                | `application/runtime`      | API and worker runtime tasks      |
| `rezics`                | `database/operations`      | root/operator installation source |
| `rezics-release`        | `release/database`         | database and maintenance tasks    |
| `rezics-release`        | `release/config`           | web release task                  |
| `rezics-infrastructure` | `database/backup-uploader` | scheduled logical backup only     |
| `rezics-infrastructure` | `database/backup-reader`   | isolated restore drill only       |

The reconciler copies the existing `database/operations` items into
`release/database` without printing them. API and worker receive
`DATABASE_URL`, never `DATABASE_ADMIN_URL`. Only the database/projection tasks
receive the administrative connection. Only the web task receives the scoped
Cloudflare Worker token and public Turnstile site key. The temporary full-access
Cloudflare token must never be installed in NixOS, Nomad, GitHub, or runtime
configuration. Backup credentials belong to a dedicated private R2 bucket and are never copied
into an application or release Variable.

See the [Nomad Variables access model](https://developer.hashicorp.com/nomad/docs/concepts/variables)
and [workload identity model](https://developer.hashicorp.com/nomad/docs/concepts/workload-identity).

## Database rules

`deploy/scripts/database-operation.sh release` runs preflight, migration, and
verification in one serialized batch job. It asserts that both administrative
and runtime URLs target the REZICS production database before doing any work.
Migration files must follow expand/contract delivery: deploy backward-compatible
structures first; destructive cleanup belongs in a later release after the old
application version can no longer run. Database migrations are forward
operations and are not automatically reversed.

Derived-data maintenance is a distinct job so it is independently observable and resumable.
If database work fails, API, worker, maintenance, and web promotion do not run.
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
PostgreSQL readiness, then use `bootstrap-production.sh --confirm-empty-database`.
The bootstrap installs the database, verifies PostgreSQL 18.4, PGroonga 4.0.8,
`approx_count` 1.0, the required preload settings and canonical indexes, and only then starts API
and worker traffic. No v1 workload owns a logical CDC slot. The dedicated backup and isolated
restore jobs are installed with the stateful topology but do not run until their independently
scoped R2 Variables exist.

## Cloudflare Worker release

The web job installs the repository-pinned Yarn version, verifies generated
offline and Cloudflare binding artifacts, builds the Worker, and uploads a new
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

Apply NixOS changes before moving an application tag that depends on them. A
host activation reconciles OIDC, workload policies, protected Variables, and
all fixed release parent jobs. Verify the gateway health endpoint, rootless
Docker daemon, loopback registry, Nomad client drivers, and Outline allocation
before dispatching the application release.

Application rollback uses a previously recorded API/worker digest and a prior
Cloudflare Worker version. Never reverse a successful database migration merely
to roll back application code. If a migration fails, repair forward before
restarting release.

The current installation is a single host and is not highly available. PostgreSQL has a daily
complete logical-backup job and weekly complete isolated restore drill documented in
[PostgreSQL backup and recovery](./postgresql-backup-recovery.md); v1 deliberately makes no PITR
claim. Outline data preservation means leaving its existing allocation,
database, volumes, and object storage untouched; it does not authorize deleting
or recreating them.
