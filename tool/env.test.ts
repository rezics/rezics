import { describe, expect, test } from "bun:test";
import {
  assertSequinRuntimeEnv,
  createToolConfig,
  SECRET_KEY_BASE_EXAMPLE,
  unsafeSequinExampleKeys,
  VAULT_KEY_EXAMPLE,
  type ToolEnv,
} from "./env";

function toolEnv(values: Partial<ToolEnv>): ToolEnv {
  return values as ToolEnv;
}

describe("tool env config boundary", () => {
  test("normalizes repo tool defaults at the edge", () => {
    const config = createToolConfig(toolEnv({ SOURCE_DB_PASSWORD: "source" }));

    expect(config.composeEnv.ENV).toBe("development");
    expect(config.composeEnv.PG_PASSWORD).toBe(
      "DO-NOT-USE-IN-PRODUCTION-sequin-state-postgres",
    );
    expect(config.composeEnv.REACTION_DB_NAME).toBe("rezics_reaction");
    expect(config.composeEnv.REACTION_DB_PASSWORD).toBe("source");
    expect(config.sourceVerifyEnv.SOURCE_DB_NAME).toBe("rezics_server");
  });

  test("reports missing required Sequin env before runtime work starts", () => {
    expect(() => assertSequinRuntimeEnv(toolEnv({}))).toThrow(
      "Missing tool environment variables",
    );
  });

  test("rejects documented unsafe Sequin example secrets", () => {
    const input = toolEnv({
      PG_PASSWORD: "state",
      SECRET_KEY_BASE: SECRET_KEY_BASE_EXAMPLE,
      VAULT_KEY: VAULT_KEY_EXAMPLE,
      SOURCE_DB_PASSWORD: "source",
      SEQUIN_WEBHOOK_SECRET: "webhook",
    });

    expect(unsafeSequinExampleKeys(input)).toEqual([
      "SECRET_KEY_BASE",
      "VAULT_KEY",
    ]);
    expect(() => assertSequinRuntimeEnv(input)).toThrow(
      "documented example secret",
    );
  });
});
