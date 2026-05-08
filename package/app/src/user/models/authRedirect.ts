type AuthRedirectState = {
  registrationComplete: boolean;
  redirectTo?: string;
};

type AppChromeState = {
  hasAuthIdentity: boolean;
  hasMemberSession: boolean;
  registrationComplete: boolean;
};

export function resolvePostAuthDestination(state: AuthRedirectState): string {
  if (!state.registrationComplete) {
    return "/complete-registration";
  }

  return state.redirectTo ?? "/";
}

export function shouldRenderNormalAppChrome(state: AppChromeState): boolean {
  if (!state.hasAuthIdentity) {
    return true;
  }

  return state.hasMemberSession && state.registrationComplete;
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
