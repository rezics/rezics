import type { Static } from "elysia";
import { t } from "elysia";
import { createVersionedEnvelopeParser } from "../envelope/envelope";
import { dockWidgetSchema } from "./widgets";

export const DOCK_SCHEMA = "rezics/dock" as const;
export const DOCK_V1_VERSION = 1 as const;

/**
 * Generic dock config. The owning resource and host placement policy live
 * outside the JSON envelope; persisted widgets are direct `{ kind, ...config }`
 * objects grouped by host-defined placements.
 */
export const dockV1Schema = t.Object(
  {
    schema: t.Literal(DOCK_SCHEMA),
    version: t.Literal(DOCK_V1_VERSION),
    placements: t.Record(t.String({ minLength: 1 }), t.Array(dockWidgetSchema)),
  },
  { additionalProperties: false },
);

export type DockV1 = Static<typeof dockV1Schema>;
export type Dock = DockV1;

const dockParser = createVersionedEnvelopeParser<Dock>({
  schemaName: DOCK_SCHEMA,
  latestVersion: DOCK_V1_VERSION,
  latestSchema: dockV1Schema,
  versions: [
    {
      version: 1,
      schema: dockV1Schema,
      upgrade: (dock) => dock as Dock,
    },
  ],
});

export const dockEnvelopeSchema = t.Union([dockV1Schema]);

export type DockEnvelope = Dock;

export function parseDock(value: unknown): Dock | null {
  return dockParser.parse(value);
}
