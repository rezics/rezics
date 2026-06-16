# Tooling

Repo-level automation lives under `tool/`. Application packages may expose env
contracts and health checks, but runtime application code must not import helper
modules from `tool/`.

## Dev Environment

The local development stack (PostgreSQL, Meilisearch, Redis, RustFS, Sequin)
is managed by Nomad through `deploy/dev/`. `task dev` starts everything —
infrastructure as Docker containers plus application dev servers as raw_exec
tasks.

```sh
task dev                 # start full dev environment
task dev:stop            # stop all services
task dev:status          # show service status
task dev:logs -- server  # follow logs for a specific task
```

### CDC Verification

Verify every Sequin CDC source database after startup:

```sh
task cdc:verify
task cdc:repair -- --source=reaction
task cdc:recover           # repair + restart Sequin via Nomad + verify
```

## Browser Inspect Workbench

`tool/browser-inspect` is a headed Playwright workbench for agent-led live URL
inspection when normal fetch/headless access is blocked by Cloudflare, login,
captcha, consent, or other browser-state flows.

Reusable helpers live in `tool/browser-inspect/src/`; one-off investigation
scripts go in the ignored `tool/browser-inspect/work/` directory.

```sh
task browser:inspect -- current.ts
```

The browser profile is stored in the ignored `tool/browser-inspect/profile/`
directory so user-completed verification and login state can be reused. The
default helper flow leaves the browser open for screenshots, DevTools, and
manual DOM/CSS copying.

## Deploy

Docker images are built and pushed to GHCR by `.github/workflows/build-images.yml`.
See [`docs/guide/deployment.md`](../docs/guide/deployment.md).
