import {
  isPublicUnitIdRouteParams,
  isPublicUnitResolverSearch,
  isPublicUnitSlugRouteParams,
  type UnitDTO,
} from "@rezics/contract";
import { notFound, redirect } from "@tanstack/react-router";
import { buildUnitUrl } from "@/shared/utils/build-url";
import { canAccessUnit } from "@/unit/canAccessUnit";

type ViewerRef = Parameters<typeof canAccessUnit>[1];

export type UnitResolverSearch = {
  view: "auto" | "unit";
};

export function validatePublicUnitSlugParams(params: unknown) {
  if (!isPublicUnitSlugRouteParams(params)) {
    throw notFound();
  }
  return params;
}

export function validatePublicUnitIdParams(params: unknown) {
  if (!isPublicUnitIdRouteParams(params)) {
    throw notFound();
  }
  return params;
}

export function validatePublicUnitResolverSearch(
  search: Record<string, unknown>,
): UnitResolverSearch {
  if (!isPublicUnitResolverSearch(search)) {
    throw new Error("Invalid Unit resolver search params");
  }

  return { view: search.view === "unit" ? "unit" : "auto" };
}

export function isUuidSegment(segment: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    segment,
  );
}

export function resolveUnitRoute({
  unit,
  viewer,
  view,
}: {
  unit: UnitDTO | null | undefined;
  viewer: ViewerRef;
  view: UnitResolverSearch["view"];
}) {
  if (!unit) throw notFound();
  if (!canAccessUnit(unit, viewer)) throw notFound();

  if (view === "unit") {
    return { unit };
  }

  const target = buildUnitUrl(unit);
  if (
    target &&
    target !== `/unit/${unit.slug}` &&
    target !== `/unit/id/${unit.id}`
  ) {
    throw redirect({ to: target });
  }

  return { unit };
}
