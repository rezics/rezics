import {
  clearAuthSessionState,
  exchangeForSessionToken,
  hydrateAuthSessionState,
  useAuthSessionStore,
} from "@/admin/auth/session/authSessionStore";
import {
  signInWithEmail,
  signOutAuthSession,
} from "@/admin/auth/session/authActions";
import { getI18nRuntime } from "@rezics/i18n/runtime";
/**
 * Admin login: sign in -> verify admin role -> exchange for session token -> hydrate.
 */
export async function adminLogin(email: string, password: string) {
  await signInWithEmail({ email, password });

  const refreshed = await exchangeForSessionToken();
  if (!refreshed) {
    throw new Error(
      getI18nRuntime().i18n.t("admin:user_login_token_exchange_failed"),
    );
  }

  await hydrateAuthSessionState();
  const role = useAuthSessionStore.getState().auth.role;
  if (!(role === "admin" || role === "owner")) {
    await signOutAuthSession();
    clearAuthSessionState();
    throw new Error(getI18nRuntime().i18n.t("admin:user_login_unauthorized"));
  }

  return { token: null };
}

/**
 * Admin logout: sign out -> clear state -> reload.
 */
export async function adminLogout() {
  await signOutAuthSession();
  useAuthSessionStore.getState().reset();
  clearAuthSessionState();
  if (typeof window !== "undefined") {
    setTimeout(() => location.reload(), 500);
  }
}
