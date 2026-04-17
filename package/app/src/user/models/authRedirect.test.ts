import { describe, expect, test } from "bun:test";
import {
  buildOAuthCallbackTargets,
  resolvePostAuthDestination,
} from "./authRedirect";

describe("authRedirect", () => {
  test("sends incomplete registration users to complete-registration", () => {
    expect(
      resolvePostAuthDestination({
        registrationComplete: false,
      }),
    ).toBe("/complete-registration");
  });

  test("sends fully registered users to home", () => {
    expect(
      resolvePostAuthDestination({
        registrationComplete: true,
      }),
    ).toBe("/");
  });

  test("builds oauth callback targets around complete-registration and auth entry routes", () => {
    expect(
      buildOAuthCallbackTargets("https://rezics.example", "register"),
    ).toEqual({
      callbackURL: "https://rezics.example/",
      newUserCallbackURL: "https://rezics.example/complete-registration",
      errorCallbackURL: "https://rezics.example/register",
    });
  });
});
