import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  DEFAULT_PUBLICATION_LICENSE_SLUG,
  LICENSE_REGISTRY,
  LICENSE_SLUGS,
  licenseSlugSchema,
} from "./license";
import { realmExtraSchema } from "./realm/realm-extra";
import {
  publishableUnitInputSchema,
  unitPublicationMetadataSchema,
} from "./unit/unit";
import { userSettingsSchema } from "./user/user";

describe("licenseSlugSchema", () => {
  test("accepts known license slugs", () => {
    expect(Value.Check(licenseSlugSchema, "cc-by-4.0")).toBe(true);
    expect(Value.Check(licenseSlugSchema, "all-rights-reserved")).toBe(true);
  });

  test("rejects unknown license slugs", () => {
    expect(Value.Check(licenseSlugSchema, "cc-by-nd-4.0")).toBe(false);
    expect(Value.Check(licenseSlugSchema, ["cc-by-4.0"])).toBe(false);
  });
});

describe("Unit publication metadata schemas", () => {
  test("accept valid publication metadata", () => {
    expect(
      Value.Check(unitPublicationMetadataSchema, {
        licenseSlug: "cc-by-sa-4.0",
      }),
    ).toBe(true);
  });

  test("reject arrays of license slugs", () => {
    expect(
      Value.Check(publishableUnitInputSchema, {
        licenseSlug: ["cc-by-4.0", "cc0-1.0"],
      }),
    ).toBe(false);
  });
});

describe("license registry", () => {
  test("uses the publication preference order", () => {
    expect(LICENSE_SLUGS).toEqual([
      "cc-by-nc-sa-4.0",
      "cc-by-sa-4.0",
      "all-rights-reserved",
      "cc-by-nc-4.0",
      "cc-by-4.0",
      "cc0-1.0",
    ]);
  });

  test("defaults to non-commercial share-alike", () => {
    expect(DEFAULT_PUBLICATION_LICENSE_SLUG).toBe("cc-by-nc-sa-4.0");
  });

  test("maps every license slug to its registry entry", () => {
    for (const slug of LICENSE_SLUGS) {
      const entry = LICENSE_REGISTRY[slug];
      expect(entry.slug).toBe(slug);
    }
  });
});

describe("publishing default schemas", () => {
  test("accept valid user publishing default", () => {
    expect(
      Value.Check(userSettingsSchema, {
        publishing: { defaultLicenseSlug: "cc0-1.0" },
      }),
    ).toBe(true);
  });

  test("reject invalid user publishing default", () => {
    expect(
      Value.Check(userSettingsSchema, {
        publishing: { defaultLicenseSlug: "unknown" },
      }),
    ).toBe(false);
  });

  test("accept valid realm publishing default", () => {
    expect(
      Value.Check(realmExtraSchema, {
        defaultLicenseSlug: "cc-by-nc-sa-4.0",
      }),
    ).toBe(true);
  });

  test("reject invalid realm publishing default", () => {
    expect(
      Value.Check(realmExtraSchema, {
        defaultLicenseSlug: "unknown",
      }),
    ).toBe(false);
  });
});
