import { describe, expect, test } from "bun:test";
import type { UnitExternalRefDTO } from "@rezics/contract";
import { sourceSiteLabel } from "./sourceSiteLabel";

function ref(
  sourceSite?: UnitExternalRefDTO["sourceSite"],
): UnitExternalRefDTO {
  return {
    id: "ref-1",
    unitId: "zone-1",
    sourceSiteEntityUnitId: "source-site-1",
    externalKind: "wiki",
    externalId: "toaru",
    canonicalUrl: "https://toaru.fandom.com/",
    firstSeenAt: "2026-06-11T00:00:00.000Z",
    lastSeenAt: "2026-06-11T00:00:00.000Z",
    sourceSite,
  };
}

describe("sourceSiteLabel", () => {
  test("prefers viewer-language source-site entity translations", () => {
    expect(
      sourceSiteLabel(
        ref({
          entityUnitId: "source-site-1",
          key: "fandom",
          crawlSupport: "none",
          crawlEnabled: false,
          refRules: [],
          supportsCrawl: false,
          canScheduleCrawl: false,
          entity: {
            unitId: "source-site-1",
            verified: true,
            eligibleCreditRoles: [],
            eligibleSubjectRoles: [],
            translations: [
              { unitId: "source-site-1", language: "en", title: "Fandom" },
              {
                unitId: "source-site-1",
                language: "zh-hant",
                title: "Fandom 維基",
              },
            ],
          },
        }),
        ["zh-hant", "en"],
      ),
    ).toBe("Fandom 維基");
  });

  test("falls back to the source-site key when entity labels are missing", () => {
    expect(
      sourceSiteLabel(
        ref({
          entityUnitId: "source-site-1",
          key: "fandom",
          crawlSupport: "none",
          crawlEnabled: false,
          refRules: [],
          supportsCrawl: false,
          canScheduleCrawl: false,
        }),
        ["zh-hant"],
      ),
    ).toBe("fandom");
  });
});
