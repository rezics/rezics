import { describe, expect, test } from "bun:test";
import { ZoneService } from "./zone.service";

describe("ZoneService.checkLifecycle", () => {
  const service = new ZoneService();

  const makeZone = (overrides: {
    startsAt?: Date | null;
    endsAt?: Date | null;
  }) =>
    ({
      startsAt: overrides.startsAt ?? null,
      endsAt: overrides.endsAt ?? null,
      unit: { translations: [] },
    }) as any;

  test("returns null for permanent zone (no lifecycle)", () => {
    const zone = makeZone({ startsAt: null, endsAt: null });
    expect(service.checkLifecycle(zone)).toBeNull();
  });

  test("returns 'not_started' when before startsAt", () => {
    const future = new Date(Date.now() + 86400000);
    const zone = makeZone({ startsAt: future });
    expect(service.checkLifecycle(zone)).toBe("not_started");
  });

  test("returns 'ended' when after endsAt", () => {
    const past = new Date(Date.now() - 86400000);
    const zone = makeZone({ endsAt: past });
    expect(service.checkLifecycle(zone)).toBe("ended");
  });

  test("returns null when within lifecycle window", () => {
    const past = new Date(Date.now() - 86400000);
    const future = new Date(Date.now() + 86400000);
    const zone = makeZone({ startsAt: past, endsAt: future });
    expect(service.checkLifecycle(zone)).toBeNull();
  });

  test("returns null when startsAt is past and no endsAt", () => {
    const past = new Date(Date.now() - 86400000);
    const zone = makeZone({ startsAt: past, endsAt: null });
    expect(service.checkLifecycle(zone)).toBeNull();
  });
});
