type AuthRedirectState = {
  registrationComplete: boolean;
  redirectTo?: string;
};

export function resolvePostAuthDestination(state: AuthRedirectState): string {
  if (!state.registrationComplete) {
    return "/complete-registration";
  }

  return state.redirectTo ?? "/";
}

export function buildOAuthCallbackTargets(
  origin: string,
  mode: "login" | "register",
) {
  return {
    callbackURL: `${origin}${resolvePostAuthDestination({
      registrationComplete: true,
    })}`,
    newUserCallbackURL: `${origin}${resolvePostAuthDestination({
      registrationComplete: false,
    })}`,
    errorCallbackURL: `${origin}/${mode}`,
  };
}
