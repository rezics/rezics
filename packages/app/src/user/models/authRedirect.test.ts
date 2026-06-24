import { describe, expect, test } from "bun:test";
import {
  buildOAuthCallbackTargets,
  resolvePostAuthDestination,
  shouldRenderNormalAppChrome,
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

  test("keeps normal app chrome available to anonymous public browsing", () => {
    expect(
      shouldRenderNormalAppChrome({
        hasAuthIdentity: false,
        hasMemberSession: false,
        registrationComplete: false,
      }),
    ).toBe(true);
  });

  test("blocks normal app chrome for incomplete auth identities", () => {
    expect(
      shouldRenderNormalAppChrome({
        hasAuthIdentity: true,
        hasMemberSession: false,
        registrationComplete: false,
      }),
    ).toBe(false);
  });

  test("allows normal app chrome only after member activation", () => {
    expect(
      shouldRenderNormalAppChrome({
        hasAuthIdentity: true,
        hasMemberSession: true,
        registrationComplete: true,
      }),
    ).toBe(true);
  });
});
