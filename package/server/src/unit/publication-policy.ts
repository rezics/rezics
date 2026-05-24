import {
  DEFAULT_PUBLICATION_LICENSE_SLUG,
  LICENSE_SLUGS,
  type LicenseSlug,
} from "@rezics/contract";
import { type Unit, UnitStatus, UnitVisibility } from "#/prisma/client";

type PublicEligibilityUnit = Pick<Unit, "status" | "visibility">;

export const publicUnitEligibilityWhere = {
  status: UnitStatus.PUBLISHED,
  visibility: UnitVisibility.PUBLIC,
} as const;

export function isPublicEligibleUnit(unit: PublicEligibilityUnit): boolean {
  return (
    unit.status === UnitStatus.PUBLISHED &&
    unit.visibility === UnitVisibility.PUBLIC
  );
}

export function assertLicenseSlug(
  value: string | null | undefined,
): LicenseSlug | null | undefined {
  if (value == null) return value;
  if ((LICENSE_SLUGS as readonly string[]).includes(value)) {
    return value as LicenseSlug;
  }
  throw new Error(`Unknown Unit publication license slug: ${value}`);
}

export function resolveStoredLicenseSlug(
  value: string | null | undefined,
): LicenseSlug {
  return assertLicenseSlug(value) ?? DEFAULT_PUBLICATION_LICENSE_SLUG;
}
