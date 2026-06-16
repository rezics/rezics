import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { validZoneConfigV1 } from "./config-v1.test";
import {
  parseZoneConfig,
  upgradeZoneConfig,
  zoneConfigEnvelopeSchema,
} from "./upgrade";

describe("zone config upgrade chain", () => {
  test("the envelope union accepts v1", () => {
    expect(Value.Check(zoneConfigEnvelopeSchema, validZoneConfigV1)).toBe(true);
  });

  test("upgradeZoneConfig is the identity for the latest version", () => {
    const upgraded = upgradeZoneConfig(structuredClone(validZoneConfigV1));
    expect(upgraded).toEqual(validZoneConfigV1);
    expect(upgraded.version).toBe(1);
  });

  test("parseZoneConfig normalizes valid documents and rejects others", () => {
    expect(parseZoneConfig(structuredClone(validZoneConfigV1))).toEqual(
      validZoneConfigV1,
    );
    expect(parseZoneConfig(null)).toBeNull();
    expect(parseZoneConfig({})).toBeNull();
    expect(parseZoneConfig({ ...validZoneConfigV1, version: 99 })).toBeNull();
    expect(
      parseZoneConfig({ ...validZoneConfigV1, schema: "rezics.content" }),
    ).toBeNull();
    // legacy six-column shapes are not readable; the factory reseed is the
    // data path (development-stage cutover)
    expect(
      parseZoneConfig({ filters: {}, configVersion: 1, template: "wiki" }),
    ).toBeNull();
  });
});
