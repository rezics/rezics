import {
  DEFAULT_PUBLICATION_LICENSE_SLUG,
  type LicenseSlug,
} from "@rezics/contract";

export interface PublicationLicenseDefaults {
  userDefault?: LicenseSlug | null;
  realmDefault?: LicenseSlug | null;
  explicitSelection?: LicenseSlug | null;
}

export function resolvePublicationLicenseDefault({
  userDefault,
  realmDefault,
  explicitSelection,
}: PublicationLicenseDefaults): LicenseSlug {
  return (
    explicitSelection ??
    realmDefault ??
    userDefault ??
    DEFAULT_PUBLICATION_LICENSE_SLUG
  );
}
