import { describe, expect, test } from "bun:test";
import { zoneColumnsGridTemplate } from "../../models/zoneColumns";

describe("zone columns section", () => {
  test("maps authored ratios to native CSS grid tracks in source order", () => {
    expect(
      zoneColumnsGridTemplate([{ ratio: 3 }, { ratio: 1 }, { ratio: 2 }]),
    ).toBe("minmax(0, 3fr) minmax(0, 1fr) minmax(0, 2fr)");
  });
});
