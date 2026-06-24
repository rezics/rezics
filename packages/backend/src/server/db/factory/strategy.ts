import type { createAuthDb } from "../../../auth/db/factory";
import type { SlugScopeName } from "@rezics/contract";
import * as v from "valibot";
import type { ServerDb } from "../client.js";
import type { SeedSyncHooks } from "./types.js";
import { powerLaw, randomInt } from "./utils.js";

type AuthDbClient = ReturnType<typeof createAuthDb>;

export type Mode = "realistic" | "fixed" | "uniform";

export interface CountSpec {
  min?: number;
  max: number;
  target?: number;
  alpha?: number;
}

export interface CountProvider {
  draw(spec: CountSpec): number;
}

export type SlugScopesMap = Record<SlugScopeName, string>;

export interface SeedCtx {
  db: ServerDb;
  authDb: AuthDbClient;
  slugScopes: SlugScopesMap;
  sync: SeedSyncHooks;
  draw(spec: CountSpec): number;
}

const DEFAULT_ALPHA = 1.8;

function midpoint(spec: CountSpec): number {
  const min = spec.min ?? 0;
  return Math.round((min + spec.max) / 2);
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function makeCountProvider(mode: Mode): CountProvider {
  switch (mode) {
    case "realistic":
      return {
        draw(spec) {
          const min = spec.min ?? 0;
          return powerLaw(min, spec.max, spec.alpha ?? DEFAULT_ALPHA);
        },
      };
    case "fixed":
      return {
        draw(spec) {
          const min = spec.min ?? 0;
          const target = spec.target ?? midpoint(spec);
          return clamp(Math.round(target), min, spec.max);
        },
      };
    case "uniform":
      return {
        draw(spec) {
          return randInt(spec.min ?? 0, spec.max);
        },
      };
  }
}

function randInt(min: number, max: number): number {
  return randomInt(min, max);
}

export function makeSeedCtx(
  db: ServerDb,
  authDb: AuthDbClient,
  slugScopes: SlugScopesMap,
  mode: Mode,
  sync: SeedSyncHooks = createNoopSeedSyncHooks(),
): SeedCtx {
  const provider = makeCountProvider(mode);
  return {
    db,
    authDb,
    slugScopes,
    sync,
    draw: (spec) => provider.draw(spec),
  };
}

export function createNoopSeedSyncHooks(): SeedSyncHooks {
  const noop = async () => {};
  return {
    content: noop,
    post: noop,
    realm: noop,
    zone: noop,
    tag: noop,
    label: noop,
    user: noop,
    entity: noop,
    contentContainedUnits: noop,
  };
}

export const CountSpecSchema = v.strictObject({
  min: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  max: v.pipe(v.number(), v.integer(), v.minValue(0)),
  target: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  alpha: v.optional(v.pipe(v.number(), v.minValue(0))),
});

export const ModeSchema = v.picklist([
  "realistic",
  "fixed",
  "uniform",
] as const);
