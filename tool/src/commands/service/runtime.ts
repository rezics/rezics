import { spawnSync } from "node:child_process";

type NonEmptyCommand = [string, ...string[]];

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
