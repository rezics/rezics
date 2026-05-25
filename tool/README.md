# Tooling

Repo-level automation lives under `tool/`. Application packages may expose env
contracts and health checks, but runtime application code must not import helper
modules from `tool/`.

## External Services

`tool/external-services` owns lifecycle wrappers for external dependencies that
are not started by `bun run dev`. The first wrapper manages Sequin CDC:

```sh
cp tool/.env.example tool/.env
```

Set real local values for `SECRET_KEY_BASE` and `VAULT_KEY` before starting
Sequin. `SEQUIN_WEBHOOK_SECRET` must match `package/job-runner/.env`.

```sh
bun run service:sequin:up
bun run service:sequin:health
bun run service:sequin:logs
bun run service:sequin:down
bun run service:sequin:config:plan
bun run service:sequin:config:apply
```

The Sequin wrapper chooses a compose runtime in this order:

1. `CONTAINER_RUNTIME` when set (`podman`, `podman-compose`, or `docker`).
2. `podman compose`.
3. `podman-compose`.
4. `docker compose`.

Local development uses `tool/external-services/sequin/compose.dev.yml` in
addition to the base topology. Production can pass `--prod` directly to
`tool/external-services/sequin.ts` to omit the dev override.

Docker local development defaults to `host.docker.internal`; Podman defaults to
`host.containers.internal`. Override the container-facing job-runner callback
with `SEQUIN_JOB_RUNNER_BASE_URL`; do not use `JOB_RUNNER_BASE_URL` in
`tool/.env`, because host-side package services own that variable themselves.
On Linux hosts with SELinux enforcing, the wrapper adds the `:Z` mount suffix
for the read-only Sequin config bind mount.

## Deploy

```sh
cd /www/wwwroot/Library.Book/Library.Book/tool/
bun run deploy
```

```sh
systemctl restart rezbooklib.service
journalctl -u rezbooklib.service -f
```
