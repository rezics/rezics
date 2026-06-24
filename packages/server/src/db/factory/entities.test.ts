import { describe, expect, test } from "bun:test";
import {
  eligibleCreditRolesForKind,
  eligibleSubjectRolesForKind,
} from "./entities";

describe("factory entity eligibility", () => {
  test("person seeds include creator credit eligibility", () => {
    expect(eligibleCreditRolesForKind("person")).toContain("author");
    expect(eligibleSubjectRolesForKind("person")).toContain("about");
  });

  test("character seeds include subject eligibility without real-world author credit", () => {
    expect(eligibleSubjectRolesForKind("character")).toContain(
      "primary_character",
    );
    expect(eligibleCreditRolesForKind("character")).not.toContain("author");
  });
});
