import { spawnSync } from "node:child_process";

type NonEmptyCommand = [string, ...string[]];

export const DOCKER_COMPOSE_COMMAND = [
  "docker",
  "compose",
] as const satisfies readonly [string, ...string[]];

function commandSucceeds(command: NonEmptyCommand): boolean {
  return (
    spawnSync(command[0], command.slice(1), { stdio: "ignore" }).status === 0
  );
}

function commandExists(command: string): boolean {
  const lookup = process.platform === "win32" ? "where" : "which";
  return spawnSync(lookup, [command], { stdio: "ignore" }).status === 0;
}

function dockerComposeV1OnlyMessage() {
  return commandExists("docker-compose") &&
    !commandSucceeds(["docker", "compose", "version"])
    ? "\nDetected docker-compose v1, but this workflow requires Docker Compose v2 (`docker compose`)."
    : "";
}

export function assertDockerComposeV2() {
  if (commandSucceeds(["docker", "compose", "version"])) {
    return;
  }

  throw new Error(
    [
      "Docker Compose v2 is required for repo-managed external services.",
      "Install Docker with the Compose v2 plugin and confirm `docker compose version` succeeds.",
      "Podman, podman-compose, and docker-compose v1 are not supported by this managed workflow.",
      dockerComposeV1OnlyMessage(),
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

export function runCommand(
  command: NonEmptyCommand,
  options: { cwd: string; env?: NodeJS.ProcessEnv },
) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Command failed with exit code ${result.status ?? "unknown"}: ${command.join(" ")}`,
    );
  }
}

export function runCompose(
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv },
) {
  assertDockerComposeV2();
  runCommand([...DOCKER_COMPOSE_COMMAND, ...args], options);
}
