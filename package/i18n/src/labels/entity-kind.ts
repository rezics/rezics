import type { EntityKind } from "@rezics/contract";
import * as m from "../paraglide/messages.js";

const ENTITY_KIND_MESSAGE = {
  person: m.entity_kind_person,
  organization: m.entity_kind_organization,
  circle: m.entity_kind_circle,
  studio: m.entity_kind_studio,
  label: m.entity_kind_label,
  character: m.entity_kind_character,
  faction: m.entity_kind_faction,
  family: m.entity_kind_family,
  location: m.entity_kind_location,
  artifact: m.entity_kind_artifact,
  event: m.entity_kind_event,
  concept: m.entity_kind_concept,
} as const satisfies Record<EntityKind, () => string>;

export const entityKindLabel = (kind: EntityKind): string =>
  ENTITY_KIND_MESSAGE[kind]();
