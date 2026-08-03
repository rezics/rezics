# Production deployment

Production has independent release boundaries:

- `apps/web` is a Vinext Cloudflare Worker on `www.rezics.com`;
- `apps/about` keeps its independent Cloudflare Pages release path;
- the API is a two-allocation Nomad service;
- the background worker is a separate one-allocation Nomad service;
- database migration and projection are separate batch operations;
- stateful PostgreSQL, Meilisearch, Sequin, and Valkey jobs are outside the
  application release graph;
- Outline is an unrelated team service and must not be stopped, migrated,
  reconfigured, or purged by REZICS delivery.

The sibling `../nixos` repository owns the host, Cloudflare Tunnel origins,
Nomad ACLs, release gateway, fixed production jobspecs, and release parent jobs.
Cloudflare Tunnel is the only public ingress to host services.

```progress
id: operations.mainland-china-edge-policy
status: open
goal: Enforce the approved Mainland China availability policy at the Cloudflare edge for every public Rezics origin.
depends: []
accept:
  - A dedicated Cloudflare zone-security Terraform stack owns hostname-scoped WAF rules instead of application code.
  - The policy covers the approved website, API, About, and Font Awesome hosts without blocking operator-only services.
  - Alternate Pages, Workers, R2, and origin paths cannot bypass the approved policy.
  - Website and API denials return the approved status and response for the active Cloudflare plan.
verify:
  - Review the Terraform plan and Cloudflare ruleset order before applying it.
  - Probe every public origin from Mainland China and a permitted region, including alternate provider hostnames.
  - Confirm denied API requests and browser requests return the approved response without invoking application origins.
```

## GitHub boundary

`Check` runs on GitHub-hosted runners for pull requests and `main`. It is an
advisory diagnostic signal: its result never gates merge, tag creation, GitHub
Release publication, or production dispatch. Fix deterministic failures when
they are found, but do not couple deployment availability to Check.

A stable `vMAJOR.MINOR.PATCH` tag starts `release.yml`. The workflow:

1. obtains a short-lived GitHub OIDC JWT for audience
   `rezics-nomad-release`;
2. sends one empty authenticated POST to
   `https://deploy.rezics.com/v1/releases/dispatch`;
3. requires a matching `202 Accepted` receipt containing the tag ref, commit,
   dispatched job ID, and evaluation ID;
4. creates the GitHub Release if it does not already exist;
5. exits without polling, streaming logs, or deciding deployment success.

The gateway validates the immutable repository and owner IDs, workflow ref,
GitHub-hosted runner, stable tag, commit, issuer, and audience. Nomad grants the
workflow a five-minute token with only `dispatch-job` in `rezics-release`.
GitHub receives no server login, SSH credential, Nomad token, database secret,
Cloudflare token, or registry credential.

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
5. explicit derived-data projection;
6. web build, Cloudflare version-override verification, and promotion.

Unchanged components are skipped. A database change conservatively invalidates
API, worker, and projection. API and worker have separate images and separate
Nomad deployments. The controller and fixed service deploy runners follow
Nomad event streams at dependency edges; there is no interval polling loop.

Nomad's canary, auto-promotion, and automatic-revert behavior follows the
[Nomad update specification](https://developer.hashicorp.com/nomad/docs/job-specification/update).
Cloudflare pre-traffic verification uses
[Worker version overrides](https://developers.cloudflare.com/workers/versions-and-deployments/version-overrides/).

```progress
id: release.component-planning
status: done
goal: Release only components whose versioned inputs changed while preserving deployment dependencies.
depends: []
accept:
  - The component manifest is the single source for release inputs and ordering.
  - Re-dispatching the same tag retries incomplete work without repeating completed components.
  - Database changes conservatively include every dependent runtime and projection component.
verify:
  - Run `bash deploy/scripts/check-release-component-plan.sh`.
  - Run `task progress:check`.
```

```progress
id: release.manual-component-dispatch
status: open
goal: Provide an authenticated manual recovery entry point for retrying or safely forcing one release component.
depends:
  - release.component-planning
accept:
  - A workflow-dispatch entry accepts a stable tag, an allowed component, and retry or force mode.
  - The release gateway verifies a dedicated OIDC audience, workflow identity, operator, tag, commit, and component allowlist.
  - The Nomad release controller recalculates dependencies and rejects unsafe force requests, including ordinary forced database releases.
  - Web retries reuse the server-owned release job without exposing Cloudflare or Nomad credentials to GitHub.
verify:
  - Run the release contract checks and inspect the manual workflow permissions.
  - Exercise retry and force against a non-production release environment and confirm unsafe component selections are rejected.
  - Confirm GitHub receives only the bounded dispatch receipt and no infrastructure credential.
```

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

| Namespace        | Path                  | Consumer                          |
| ---------------- | --------------------- | --------------------------------- |
| `rezics`         | `application/runtime` | API and worker runtime tasks      |
| `rezics`         | `database/operations` | root/operator installation source |
| `rezics-release` | `release/database`    | database and projection tasks     |
| `rezics-release` | `release/config`      | web release task                  |

The reconciler copies the existing `database/operations` items into
`release/database` without printing them. API and worker receive
`DATABASE_URL`, never `DATABASE_ADMIN_URL`. Only the database/projection tasks
receive the administrative connection. Only the web task receives the scoped
Cloudflare Worker token and public Turnstile site key. The temporary full-access
Cloudflare token must never be installed in NixOS, Nomad, GitHub, or runtime
configuration.

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

Projection is a distinct job so it is independently observable and resumable.
If database work fails, API, worker, projection, and web promotion do not run.
Outline uses its existing independent database configuration and is never part
of these operations.

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

The current installation is a single host and is not highly available. Its
stateful services have no application-managed backup or point-in-time recovery
workflow. Outline data preservation means leaving its existing allocation,
database, volumes, and object storage untouched; it does not authorize deleting
or recreating them.

```progress
id: operations.backup-recovery
status: open
goal: Establish encrypted, off-host backup and tested recovery for every production state owner.
depends: []
accept:
  - PostgreSQL has scheduled base backups and continuous recovery data with documented retention and encryption.
  - R2 or object-storage data, Meilisearch rebuild inputs, Sequin state, Nomad Variables, and required host configuration each have an explicit backup or reproducible-rebuild contract.
  - Outline remains outside Rezics automation and has an independently approved preservation and recovery procedure.
  - The runbook defines restore order, credentials, recovery-point and recovery-time objectives, failure handling, and destructive-action safeguards.
  - A clean recovery rehearsal restores a consistent application state and records actionable evidence without secrets.
verify:
  - Perform the documented recovery rehearsal in an isolated environment from off-host backup material.
  - Verify database consistency, object availability, search reconstruction, application readiness, and Outline independence.
  - Review backup age, failed-job alerting, restore credentials, and retention with the production operator.
```
