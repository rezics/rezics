import type { JobRunnerRole } from "../env";

export type SequinHealthPreflightOptions = {
  role: JobRunnerRole;
  healthUrl?: string;
  fetchImpl?: typeof fetch;
};

export function roleRequiresSequinHealth(role: JobRunnerRole) {
  return role === "all" || role === "http";
}

export async function assertSequinHealthAvailable({
  role,
  healthUrl,
  fetchImpl = fetch,
}: SequinHealthPreflightOptions) {
  if (!roleRequiresSequinHealth(role)) {
    return;
  }

  if (!healthUrl) {
    throw new Error(
      [
        `JOB_RUNNER_ROLE=${role} requires Sequin health before exposing /webhooks/sequin.`,
        "Set SEQUIN_HEALTH_URL to the Sequin /health endpoint.",
        "Start the managed runtime with: bun run service:up",
      ].join("\n"),
    );
  }

  let response: Response;
  try {
    response = await fetchImpl(healthUrl);
  } catch (error) {
    throw new Error(
      [
        `JOB_RUNNER_ROLE=${role} requires Sequin health before exposing /webhooks/sequin.`,
        `Checked URL: ${healthUrl}`,
        `Request failed: ${error instanceof Error ? error.message : String(error)}`,
        "Start the managed runtime with: bun run service:up",
      ].join("\n"),
    );
  }

  if (!response.ok) {
    throw new Error(
      [
        `JOB_RUNNER_ROLE=${role} requires Sequin health before exposing /webhooks/sequin.`,
        `Checked URL: ${healthUrl}`,
        `Received HTTP ${response.status}.`,
        "Start the managed runtime with: bun run service:up",
      ].join("\n"),
    );
  }
}
