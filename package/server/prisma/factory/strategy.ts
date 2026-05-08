import type { PrismaClient as AuthPrismaClient } from "@rezics/auth/prisma/generated/client";
import * as v from "valibot";
import type { PrismaClient } from "../generated/client.js";
import { powerLaw, randomInt } from "./utils.js";

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

export interface SeedCtx {
  prisma: PrismaClient;
  authPrisma: AuthPrismaClient;
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
  prisma: PrismaClient,
  authPrisma: AuthPrismaClient,
  mode: Mode,
): SeedCtx {
  const provider = makeCountProvider(mode);
  return {
    prisma,
    authPrisma,
    draw: (spec) => provider.draw(spec),
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
