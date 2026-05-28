import type { LicenseSlug } from "@rezics/contract";

import { getI18nRuntime } from "../runtime.ts";

const LICENSE_KEY = {
  "cc-by-nc-sa-4.0": "settings:license_cc_by_nc_sa_4_0",
  "cc-by-sa-4.0": "settings:license_cc_by_sa_4_0",
  "all-rights-reserved": "settings:license_all_rights_reserved",
  "cc-by-nc-4.0": "settings:license_cc_by_nc_4_0",
  "cc-by-4.0": "settings:license_cc_by_4_0",
  "cc0-1.0": "settings:license_cc0_1_0",
} as const satisfies Record<LicenseSlug, `settings:${string}`>;

export const licenseLabel = (license: LicenseSlug): string =>
  getI18nRuntime().i18n.t(LICENSE_KEY[license]);
