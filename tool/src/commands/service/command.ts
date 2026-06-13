import { define } from "gunshi";
import { runServiceCommand } from "./commands";

export const serviceSubCommands = {
  up: define({
    name: "up",
    description: "Start repo-managed external services.",
    run: () => runServiceCommand({ kind: "up" }),
  }),
  down: define({
    name: "down",
    description: "Stop repo-managed external services.",
    run: () => runServiceCommand({ kind: "down" }),
  }),
  logs: define({
    name: "logs",
    description: "Follow managed service logs.",
    args: {
      service: {
        type: "positional",
        multiple: true,
        description: "Optional Compose service names.",
      },
    },
    run: (ctx) =>
      runServiceCommand({
        kind: "logs",
        services: (ctx.values.service ?? []) as string[],
      }),
  }),
  ps: define({
    name: "ps",
    description: "Show managed service containers.",
    run: () => runServiceCommand({ kind: "ps" }),
  }),
  health: define({
    name: "health",
    description: "Check managed service health.",
    run: () => runServiceCommand({ kind: "health" }),
  }),
  config: define({
    name: "config",
    description: "Inspect or apply managed service configuration.",
    subCommands: {
      plan: define({
        name: "plan",
        description: "Render the Docker Compose plan.",
        run: () => runServiceCommand({ kind: "config-plan" }),
      }),
      apply: define({
        name: "apply",
        description: "Recreate Sequin so its config file is applied.",
        run: () => runServiceCommand({ kind: "config-apply" }),
      }),
    },
  }),
  cdc: define({
    name: "cdc",
    description: "Verify or repair every Sequin CDC source.",
    subCommands: {
      verify: define({
        name: "verify",
        description: "Verify every Sequin CDC source.",
        args: {
          source: {
            type: "string",
            description: "Limit verification to source or reaction.",
          },
          sourceUrl: {
            type: "string",
            toKebab: true,
            description: "Override server source Postgres connection URL.",
          },
          reactionUrl: {
            type: "string",
            toKebab: true,
            description: "Override reaction Postgres connection URL.",
          },
        },
        toKebab: true,
        run: (ctx) =>
          runServiceCommand({
            kind: "cdc-verify",
            source: ctx.values.source as "source" | "reaction" | undefined,
            sourceUrl: ctx.values.sourceUrl as string | undefined,
            reactionUrl: ctx.values.reactionUrl as string | undefined,
          }),
      }),
      repair: define({
        name: "repair",
        description:
          "Repair local Sequin CDC sources with apply/dev-reset semantics.",
        args: {
          source: {
            type: "string",
            description: "Limit repair to source or reaction.",
          },
          sourceUrl: {
            type: "string",
            toKebab: true,
            description: "Override server source Postgres connection URL.",
          },
          reactionUrl: {
            type: "string",
            toKebab: true,
            description: "Override reaction Postgres connection URL.",
          },
          forceActiveSlot: {
            type: "boolean",
            toKebab: true,
            description: "Drop an active local replication slot.",
          },
        },
        toKebab: true,
        run: (ctx) =>
          runServiceCommand({
            kind: "cdc-repair",
            source: ctx.values.source as "source" | "reaction" | undefined,
            sourceUrl: ctx.values.sourceUrl as string | undefined,
            reactionUrl: ctx.values.reactionUrl as string | undefined,
            forceActiveSlot: Boolean(ctx.values.forceActiveSlot),
          }),
      }),
    },
  }),
  source: define({
    name: "source",
    description: "Verify or repair the source Postgres CDC setup.",
    subCommands: {
      verify: define({
        name: "verify",
        description: "Verify source Postgres CDC readiness.",
        args: {
          url: {
            type: "string",
            description: "Override source Postgres connection URL.",
          },
        },
        run: (ctx) =>
          runServiceCommand({
            kind: "source-verify",
            url: ctx.values.url as string | undefined,
          }),
      }),
      repair: define({
        name: "repair",
        description:
          "Repair local source Postgres CDC readiness with apply/dev-reset.",
        args: {
          url: {
            type: "string",
            description: "Override source Postgres connection URL.",
          },
          forceActiveSlot: {
            type: "boolean",
            toKebab: true,
            description: "Drop an active local replication slot.",
          },
        },
        toKebab: true,
        run: (ctx) =>
          runServiceCommand({
            kind: "source-repair",
            url: ctx.values.url as string | undefined,
            forceActiveSlot: Boolean(ctx.values.forceActiveSlot),
          }),
      }),
    },
  }),
};

export const serviceCommand = define({
  name: "service",
  description:
    "Start, stop, inspect, and repair repo-managed development services.",
  subCommands: serviceSubCommands,
});
