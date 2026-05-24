import { t } from "elysia";
import { type SystemShelfKindKey, systemShelfKindKeySchema } from "../progress";

export const SYSTEM_SHELF_LABELS: Record<SystemShelfKindKey, string> = {
  favorites: "Favorites",
  backlog: "Backlog",
  active: "Active",
  completed: "Completed",
};

export function formatSystemShelfTitle(
  slug: string,
  kindKey: SystemShelfKindKey,
  label?: string,
): string {
  return `${slug}'s ${label ?? SYSTEM_SHELF_LABELS[kindKey]}`;
}

export const ensureSystemShelfBodySchema = t.Object(
  {
    kindKey: systemShelfKindKeySchema,
  },
  { additionalProperties: false },
);

export type EnsureSystemShelfBody =
  (typeof ensureSystemShelfBodySchema)["static"];

export const ensureSystemShelfResponseSchema = t.Object({
  unitId: t.String(),
  created: t.Boolean(),
});

export type EnsureSystemShelfResponse =
  (typeof ensureSystemShelfResponseSchema)["static"];
