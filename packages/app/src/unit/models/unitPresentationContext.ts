export type UnitPresentationKind =
  | "book"
  | "post"
  | "wiki"
  | "realm"
  | "zone"
  | "unit";

export type UnitPresentationVisibility = "visible" | "hidden";

export type UnitPresentationContext =
  | {
      kind: "unit";
      unitKind: UnitPresentationKind;
      unitId: string;
      visibility: UnitPresentationVisibility;
    }
  | {
      kind: "realm";
      realmUnitId: string;
      visibility: UnitPresentationVisibility;
    }
  | {
      kind: "zone";
      zoneUnitId: string | null;
      zoneSlug: string | null;
      visibility: UnitPresentationVisibility;
    }
  | { kind: "none"; visibility: "hidden" };

export type UnitInteractionContext =
  | { kind: "direct" }
  | { kind: "realm"; realmUnitId: string };

export function unitPresentationContext(input: {
  unitKind: UnitPresentationKind;
  unitId: string;
  visibility?: UnitPresentationVisibility;
}): Extract<UnitPresentationContext, { kind: "unit" }> {
  return {
    kind: "unit",
    unitKind: input.unitKind,
    unitId: input.unitId,
    visibility: input.visibility ?? "visible",
  };
}

export function hiddenUnitPresentationContext(
  unitKind: UnitPresentationKind,
  unitId: string,
): Extract<UnitPresentationContext, { kind: "unit" }> {
  return unitPresentationContext({
    unitKind,
    unitId,
    visibility: "hidden",
  });
}

export function realmPresentationContext(
  realmUnitId: string,
  visibility: UnitPresentationVisibility = "visible",
): Extract<UnitPresentationContext, { kind: "realm" }> {
  return { kind: "realm", realmUnitId, visibility };
}

export function zonePresentationContext(input: {
  zoneUnitId?: string | null;
  zoneSlug?: string | null;
  visibility?: UnitPresentationVisibility;
}): Extract<UnitPresentationContext, { kind: "zone" }> {
  return {
    kind: "zone",
    zoneUnitId: input.zoneUnitId ?? null,
    zoneSlug: input.zoneSlug ?? null,
    visibility: input.visibility ?? "visible",
  };
}

export function shouldDisplayPresentationContext(
  context: UnitPresentationContext,
): boolean {
  return context.visibility === "visible" && context.kind !== "none";
}
