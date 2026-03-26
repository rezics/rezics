type AuthRedirectState = {
  needsOnboarding: boolean;
  needsVerification: boolean;
  readyForApp?: boolean;
  redirectTo?: string;
};

export function resolvePostAuthDestination(
  state: AuthRedirectState,
): string {
  if (state.needsOnboarding) {
    return '/onboarding';
  }

  if (state.needsVerification) {
    return '/verify-email';
  }

  return state.redirectTo ?? '/';
}

export function buildOAuthCallbackTargets(origin: string, mode: 'login' | 'register') {
  return {
    callbackURL: `${origin}${resolvePostAuthDestination({
      needsOnboarding: false,
      needsVerification: false,
      readyForApp: true,
    })}`,
    newUserCallbackURL: `${origin}${resolvePostAuthDestination({
      needsOnboarding: true,
      needsVerification: false,
    })}`,
    errorCallbackURL: `${origin}/${mode}`,
  };
}
