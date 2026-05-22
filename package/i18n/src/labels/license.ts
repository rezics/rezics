import type { LicenseSlug } from "@rezics/contract";
import * as m from "../paraglide/messages.js";

const LICENSE_MESSAGE = {
  "cc-by-nc-sa-4.0": m.license_cc_by_nc_sa_4_0,
  "cc-by-sa-4.0": m.license_cc_by_sa_4_0,
  "all-rights-reserved": m.license_all_rights_reserved,
  "cc-by-nc-4.0": m.license_cc_by_nc_4_0,
  "cc-by-4.0": m.license_cc_by_4_0,
  "cc0-1.0": m.license_cc0_1_0,
} as const satisfies Record<LicenseSlug, () => string>;

export const licenseLabel = (license: LicenseSlug): string =>
  LICENSE_MESSAGE[license]();
