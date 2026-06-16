import { define } from "gunshi";
import { runServiceCommand } from "./commands";

export const serviceSubCommands = {
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
        description: "Low-level local source-object repair for Sequin CDC.",
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
      recover: define({
        name: "recover",
        description:
          "Recover local Sequin CDC end-to-end by repairing source objects, restarting Sequin via Nomad, and verifying.",
        args: {
          source: {
            type: "string",
            description: "Limit recovery to source or reaction.",
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
          logTail: {
            type: "number",
            toKebab: true,
            description:
              "Recent Sequin log lines to print when recovery fails.",
            default: 200,
          },
        },
        toKebab: true,
        run: (ctx) =>
          runServiceCommand({
            kind: "cdc-recover",
            source: ctx.values.source as "source" | "reaction" | undefined,
            sourceUrl: ctx.values.sourceUrl as string | undefined,
            reactionUrl: ctx.values.reactionUrl as string | undefined,
            forceActiveSlot: Boolean(ctx.values.forceActiveSlot),
            logTail: ctx.values.logTail as number | undefined,
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
  description: "Verify and repair Sequin CDC source databases.",
  subCommands: serviceSubCommands,
});
