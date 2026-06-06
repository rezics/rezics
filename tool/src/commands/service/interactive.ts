import * as p from "@clack/prompts";
import { runServiceCommand, type ServiceCommand } from "./commands";

type InteractiveAction =
  | "up"
  | "down"
  | "ps"
  | "health"
  | "config-plan"
  | "config-apply"
  | "source-verify"
  | "source-repair"
  | "logs-all"
  | "exit";

const COMPOSE_SERVICE_OPTIONS = [
  { value: "source-postgres", label: "source-postgres" },
  { value: "meilisearch", label: "meilisearch" },
  { value: "sequin", label: "sequin" },
  { value: "sequin-postgres", label: "sequin-postgres" },
  { value: "sequin-redis", label: "sequin-redis" },
  { value: "clickstack", label: "clickstack", hint: "observability profile" },
  {
    value: "otel-collector",
    label: "otel-collector",
    hint: "observability profile",
  },
] as const;

function cancel(): never {
  p.cancel("Cancelled.");
  process.exit(0);
}

async function confirmOrCancel(message: string): Promise<void> {
  const confirmed = await p.confirm({ message });
  if (p.isCancel(confirmed) || !confirmed) {
    cancel();
  }
}

async function optionalUrl(): Promise<string | undefined> {
  const override = await p.confirm({
    message: "Override the source Postgres connection URL?",
    initialValue: false,
  });
  if (p.isCancel(override)) {
    cancel();
  }
  if (!override) {
    return undefined;
  }

  const url = await p.text({
    message: "Source Postgres URL",
    placeholder: "postgresql://postgres:postgres@localhost:5432/rezics_server",
    validate: (value) =>
      value.trim().length === 0
        ? "Enter a Postgres connection URL."
        : undefined,
  });
  if (p.isCancel(url)) {
    cancel();
  }
  return url.trim();
}

async function logsCommand(): Promise<ServiceCommand> {
  const target = await p.select<"all" | "service">({
    message: "Which logs should be followed?",
    initialValue: "all",
    options: [
      { value: "all", label: "All services" },
      { value: "service", label: "Selected services" },
    ],
  });
  if (p.isCancel(target)) {
    cancel();
  }
  if (target === "all") {
    return { kind: "logs", services: [] };
  }

  const services = await p.multiselect<
    (typeof COMPOSE_SERVICE_OPTIONS)[number]["value"]
  >({
    message: "Select services",
    required: true,
    options: [...COMPOSE_SERVICE_OPTIONS],
  });
  if (p.isCancel(services)) {
    cancel();
  }
  return { kind: "logs", services: [...services] };
}

async function sourceVerifyCommand(): Promise<ServiceCommand> {
  return { kind: "source-verify", url: await optionalUrl() };
}

async function sourceRepairCommand(): Promise<ServiceCommand> {
  await confirmOrCancel(
    "Repair source Postgres CDC setup? This can alter local Postgres settings and recreate local publication/slot state.",
  );
  const url = await optionalUrl();
  const forceActiveSlot = await p.confirm({
    message: "Drop an active local replication slot if needed?",
    initialValue: false,
  });
  if (p.isCancel(forceActiveSlot)) {
    cancel();
  }
  return { kind: "source-repair", url, forceActiveSlot };
}

async function commandForAction(
  action: InteractiveAction,
): Promise<ServiceCommand | undefined> {
  if (action === "exit") {
    return undefined;
  }
  if (action === "logs-all") {
    return logsCommand();
  }
  if (action === "source-verify") {
    return sourceVerifyCommand();
  }
  if (action === "source-repair") {
    return sourceRepairCommand();
  }
  if (action === "down") {
    await confirmOrCancel("Stop repo-managed external services?");
  }
  if (action === "config-apply") {
    await confirmOrCancel("Recreate Sequin so its config file is applied?");
  }
  if (
    action === "up" ||
    action === "down" ||
    action === "ps" ||
    action === "health" ||
    action === "config-plan" ||
    action === "config-apply"
  ) {
    return { kind: action };
  }
}

export async function runInteractiveServiceCli(): Promise<void> {
  p.intro("Rezics Services");
  const action = await p.select<InteractiveAction>({
    message: "What do you want to do?",
    initialValue: "up",
    options: [
      { value: "up", label: "Start services", hint: "docker compose up -d" },
      { value: "down", label: "Stop services", hint: "docker compose down" },
      { value: "ps", label: "Show status", hint: "docker compose ps" },
      { value: "health", label: "Check health" },
      { value: "logs-all", label: "Follow logs" },
      { value: "source-verify", label: "Verify source Postgres" },
      { value: "source-repair", label: "Repair source Postgres" },
      { value: "config-plan", label: "Show compose config" },
      { value: "config-apply", label: "Apply Sequin config" },
      { value: "exit", label: "Exit" },
    ],
  });
  if (p.isCancel(action)) {
    cancel();
  }

  const command = await commandForAction(action);
  if (!command) {
    p.outro("Done.");
    return;
  }

  await runServiceCommand(command);
  if (command.kind !== "logs") {
    p.outro("Done.");
  }
}
