import type { EntityKind } from "@rezics/contract";

import { getI18nRuntime } from "../runtime.ts";

const ENTITY_KIND_KEY = {
  person: "entity:kind_person",
  organization: "entity:kind_organization",
  circle: "entity:kind_circle",
  studio: "entity:kind_studio",
  label: "entity:kind_label",
  character: "entity:kind_character",
  faction: "entity:kind_faction",
  family: "entity:kind_family",
  location: "entity:kind_location",
  artifact: "entity:kind_artifact",
  event: "entity:kind_event",
  concept: "entity:kind_concept",
  game_platform: "entity:kind_game_platform",
  universe: "entity:kind_universe",
} as const satisfies Record<EntityKind, `entity:${string}`>;

export const entityKindLabel = (kind: EntityKind): string =>
  getI18nRuntime().i18n.t(ENTITY_KIND_KEY[kind]);
