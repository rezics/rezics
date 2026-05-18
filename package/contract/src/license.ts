import { t } from "elysia";

export const LICENSE_REGISTRY = {
  "all-rights-reserved": {
    slug: "all-rights-reserved",
    label: "All rights reserved",
  },
  "cc0-1.0": {
    slug: "cc0-1.0",
    label: "CC0 1.0 Universal",
    url: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  "cc-by-4.0": {
    slug: "cc-by-4.0",
    label: "Creative Commons Attribution 4.0",
    url: "https://creativecommons.org/licenses/by/4.0/",
  },
  "cc-by-sa-4.0": {
    slug: "cc-by-sa-4.0",
    label: "Creative Commons Attribution-ShareAlike 4.0",
    url: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  "cc-by-nc-4.0": {
    slug: "cc-by-nc-4.0",
    label: "Creative Commons Attribution-NonCommercial 4.0",
    url: "https://creativecommons.org/licenses/by-nc/4.0/",
  },
  "cc-by-nc-sa-4.0": {
    slug: "cc-by-nc-sa-4.0",
    label: "Creative Commons Attribution-NonCommercial-ShareAlike 4.0",
    url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
  },
} as const;

export const LICENSE_SLUGS = Object.keys(LICENSE_REGISTRY) as LicenseSlug[];

export const DEFAULT_PUBLICATION_LICENSE_SLUG = "all-rights-reserved";

export type LicenseSlug = keyof typeof LICENSE_REGISTRY;

export const licenseSlugSchema = t.Union([
  t.Literal("all-rights-reserved"),
  t.Literal("cc0-1.0"),
  t.Literal("cc-by-4.0"),
  t.Literal("cc-by-sa-4.0"),
  t.Literal("cc-by-nc-4.0"),
  t.Literal("cc-by-nc-sa-4.0"),
]);

export const licenseRegistryEntrySchema = t.Object({
  slug: licenseSlugSchema,
  label: t.String(),
  url: t.Optional(t.String()),
});

export type LicenseRegistryEntry =
  (typeof licenseRegistryEntrySchema)["static"];
