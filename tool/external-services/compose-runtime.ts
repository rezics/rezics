import { spawnSync } from "node:child_process";

export type ComposeRuntimeKind = "podman" | "podman-compose" | "docker";

export type ComposeRuntime = {
  kind: ComposeRuntimeKind;
  command: [string, ...string[]];
  hostAlias: string;
};

const supportedRuntimeNames = new Set(["podman", "podman-compose", "docker"]);

function commandExists(command: string): boolean {
  const lookup = process.platform === "win32" ? "where" : "which";
  return spawnSync(lookup, [command], { stdio: "ignore" }).status === 0;
}

type NonEmptyCommand = [string, ...string[]];

function commandSucceeds(command: NonEmptyCommand): boolean {
  return (
    spawnSync(command[0], command.slice(1), { stdio: "ignore" }).status === 0
  );
}

function hasDockerComposeV1Only(): boolean {
  return (
    commandExists("docker-compose") &&
    !commandSucceeds(["docker", "compose", "version"])
  );
}

function knownRuntimeError(name: string): Error {
  if (!supportedRuntimeNames.has(name)) {
    return new Error(
      `Unknown CONTAINER_RUNTIME "${name}". Supported values: podman, podman-compose, docker.`,
    );
  }

  return new Error(
    `CONTAINER_RUNTIME="${name}" was requested, but its compose command is not available on PATH.`,
  );
}

export function detectComposeRuntime(
  requested?: ComposeRuntimeKind,
): ComposeRuntime {
  if (requested) {
    if (
      requested === "podman" &&
      commandSucceeds(["podman", "compose", "version"])
    ) {
      return {
        kind: "podman",
        command: ["podman", "compose"],
        hostAlias: "host.containers.internal",
      };
    }

    if (requested === "podman-compose" && commandExists("podman-compose")) {
      return {
        kind: "podman-compose",
        command: ["podman-compose"],
        hostAlias: "host.containers.internal",
      };
    }

    if (
      requested === "docker" &&
      commandSucceeds(["docker", "compose", "version"])
    ) {
      return {
        kind: "docker",
        command: ["docker", "compose"],
        hostAlias: "host.docker.internal",
      };
    }

    throw knownRuntimeError(requested);
  }

  if (commandSucceeds(["podman", "compose", "version"])) {
    return {
      kind: "podman",
      command: ["podman", "compose"],
      hostAlias: "host.containers.internal",
    };
  }

  if (commandExists("podman-compose")) {
    return {
      kind: "podman-compose",
      command: ["podman-compose"],
      hostAlias: "host.containers.internal",
    };
  }

  if (commandSucceeds(["docker", "compose", "version"])) {
    return {
      kind: "docker",
      command: ["docker", "compose"],
      hostAlias: "host.docker.internal",
    };
  }

  const dockerComposeV1Message = hasDockerComposeV1Only()
    ? "\nDetected docker-compose v1, but this wrapper requires Docker Compose v2 (`docker compose`)."
    : "";

  throw new Error(
    `No supported compose runtime found. Install Podman with compose support, podman-compose, or Docker with Compose v2.${dockerComposeV1Message}`,
  );
}

export function runCompose(
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
      `Compose command failed with exit code ${result.status ?? "unknown"}: ${command.join(" ")}`,
    );
  }
}
