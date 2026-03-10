import {describe, expect, test} from 'bun:test';
import {
  buildOAuthCallbackTargets,
  resolvePostAuthDestination,
} from './authRedirect';

describe('authRedirect', () => {
  test('sends newly registered email users to verification before the app', () => {
    expect(
      resolvePostAuthDestination({
        needsOnboarding: false,
        needsVerification: true,
        readyForApp: false,
      }),
    ).toBe('/verify-email');
  });

  test('sends oauth users needing setup to onboarding', () => {
    expect(
      resolvePostAuthDestination({
        needsOnboarding: true,
        needsVerification: false,
      }),
    ).toBe('/onboarding');
  });

  test('builds oauth callback targets around onboarding and auth entry routes', () => {
    expect(buildOAuthCallbackTargets('https://rezics.example', 'register')).toEqual({
      callbackURL: 'https://rezics.example/',
      newUserCallbackURL: 'https://rezics.example/onboarding',
      errorCallbackURL: 'https://rezics.example/register',
    });
  });
});
