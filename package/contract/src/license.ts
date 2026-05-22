import { t } from "elysia";

export const LICENSE_REGISTRY = {
  "cc-by-nc-sa-4.0": {
    slug: "cc-by-nc-sa-4.0",
    url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
  },
  "cc-by-sa-4.0": {
    slug: "cc-by-sa-4.0",
    url: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  "all-rights-reserved": {
    slug: "all-rights-reserved",
  },
  "cc-by-nc-4.0": {
    slug: "cc-by-nc-4.0",
    url: "https://creativecommons.org/licenses/by-nc/4.0/",
  },
  "cc-by-4.0": {
    slug: "cc-by-4.0",
    url: "https://creativecommons.org/licenses/by/4.0/",
  },
  "cc0-1.0": {
    slug: "cc0-1.0",
    url: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
} as const;

export const DEFAULT_PUBLICATION_LICENSE_SLUG = "cc-by-nc-sa-4.0";

export type LicenseSlug = keyof typeof LICENSE_REGISTRY;

export const LICENSE_SLUGS = [
  "cc-by-nc-sa-4.0",
  "cc-by-sa-4.0",
  "all-rights-reserved",
  "cc-by-nc-4.0",
  "cc-by-4.0",
  "cc0-1.0",
] as const satisfies readonly LicenseSlug[];

export const licenseSlugSchema = t.Union([
  t.Literal("cc-by-nc-sa-4.0"),
  t.Literal("cc-by-sa-4.0"),
  t.Literal("all-rights-reserved"),
  t.Literal("cc-by-nc-4.0"),
  t.Literal("cc-by-4.0"),
  t.Literal("cc0-1.0"),
]);

export const licenseRegistryEntrySchema = t.Object({
  slug: licenseSlugSchema,
  url: t.Optional(t.String()),
});

export type LicenseRegistryEntry =
  (typeof licenseRegistryEntrySchema)["static"];
