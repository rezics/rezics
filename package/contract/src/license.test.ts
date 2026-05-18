import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { realmExtraSchema } from "./realm/realm-extra";
import {
  licenseSlugSchema,
  publishableUnitInputSchema,
  unitPublicationMetadataSchema,
} from "./index";
import { userSettingsSchema } from "./user";

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
        copyrightNotice: "Copyright 2026 Rezics",
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
