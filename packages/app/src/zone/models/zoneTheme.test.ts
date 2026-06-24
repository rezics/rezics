import { describe, expect, it } from "bun:test";
import type { ZoneTheme } from "@rezics/contract";
import { zoneThemeCssVars } from "./zoneTheme";

describe("zoneThemeCssVars", () => {
  it("emits content max width as a px CSS variable when set", () => {
    const theme: ZoneTheme = {
      schema: "rezics/zone-theme",
      version: 1,
      layout: { contentMaxWidth: 1280 },
    };

    expect(zoneThemeCssVars(theme)).toMatchObject({
      "--zone-content-max-width": "1280px",
    });
  });

  it("omits content max width when absent", () => {
    const theme: ZoneTheme = {
      schema: "rezics/zone-theme",
      version: 1,
      layout: {},
    };

    expect(zoneThemeCssVars(theme)).not.toHaveProperty(
      "--zone-content-max-width",
    );
  });
});
