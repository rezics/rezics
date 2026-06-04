import {
  DEFAULT_PUBLICATION_LICENSE_SLUG,
  LICENSE_SLUGS,
  type LicenseSlug,
} from "@rezics/contract";

type PublicEligibilityUnit = {
  status: string;
  visibility: string;
  moderationStatus: string | null;
};

export const publicUnitEligibilityWhere = {
  status: "PUBLISHED",
  visibility: "PUBLIC",
  moderationStatus: "APPROVED",
} as const;

export function isPublicEligibleUnit(unit: PublicEligibilityUnit): boolean {
  return (
    unit.status === publicUnitEligibilityWhere.status &&
    unit.visibility === publicUnitEligibilityWhere.visibility &&
    unit.moderationStatus === publicUnitEligibilityWhere.moderationStatus
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
