import { describe, expect, test } from "bun:test";
import { t } from "elysia";
import { createVersionedEnvelopeParser } from "./envelope";

const schemaName = "rezics/test-envelope";

const v1Schema = t.Object(
  {
    schema: t.Literal(schemaName),
    version: t.Literal(1),
    value: t.String(),
  },
  { additionalProperties: false },
);

const v2Schema = t.Object(
  {
    schema: t.Literal(schemaName),
    version: t.Literal(2),
    value: t.String(),
    label: t.String(),
  },
  { additionalProperties: false },
);

type V1 = typeof v1Schema.static;
type V2 = typeof v2Schema.static;

function testParser(fullValidation = false) {
  return createVersionedEnvelopeParser<V2>({
    schemaName,
    latestVersion: 2,
    latestSchema: v2Schema,
    fullValidation,
    versions: [
      {
        version: 1,
        schema: v1Schema,
        upgrade: (value) => ({
          ...(value as V1),
          version: 2,
          label: "upgraded",
        }),
      },
      {
        version: 2,
        schema: v2Schema,
        upgrade: (value) => value as V2,
      },
    ],
  });
}

describe("versioned envelope parser", () => {
  test("dispatches historical versions through the upgrade chain", () => {
    expect(
      testParser().parse({
        schema: schemaName,
        version: 1,
        value: "old",
      }),
    ).toEqual({
      schema: schemaName,
      version: 2,
      value: "old",
      label: "upgraded",
    });
  });

  test("rejects unknown versions by envelope metadata", () => {
    expect(testParser().parse({ schema: schemaName, version: 99 })).toBeNull();
  });

  test("normal reads trust the envelope body after metadata dispatch", () => {
    const parsed = testParser().parse({ schema: schemaName, version: 2 });
    expect(parsed as unknown).toEqual({
      schema: schemaName,
      version: 2,
    });
  });

  test("development full validation checks the historical body schema", () => {
    expect(
      testParser(true).parse({
        schema: schemaName,
        version: 2,
      }),
    ).toBeNull();
  });

  test("upgrade functions cannot declare context parameters", () => {
    expect(() =>
      createVersionedEnvelopeParser<V2>({
        schemaName,
        latestVersion: 2,
        latestSchema: v2Schema,
        versions: [
          {
            version: 1,
            schema: v1Schema,
            // @ts-expect-error This test verifies runtime rejection for invalid upgrade signatures.
            upgrade: (_value: unknown, _context: unknown) => {
              throw new Error("unreachable");
            },
          },
        ],
      }),
    ).toThrow("must accept only the stored value");
  });
});
