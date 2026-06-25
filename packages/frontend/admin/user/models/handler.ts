import { authApi } from "@rezics/contract/api/auth/auth.api";
import { authKeys } from "@rezics/contract/api/auth/auth.keys";
import {
  clearAuthSessionState,
  exchangeForSessionToken,
  hydrateAuthSessionState,
  useAuthSessionStore,
} from "@/admin/auth/session/authSessionStore";
import { userKeys } from "@rezics/contract/api/user/user.keys";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import { qc } from "@/admin/app/providers/reactQueryUtil";
/**
 * Admin login: sign in -> verify admin role -> exchange for session token -> hydrate.
 */
export async function adminLogin(email: string, password: string) {
  await authApi.signIn({ email, password });

  const refreshed = await exchangeForSessionToken();
  if (!refreshed) {
    throw new Error(
      getI18nRuntime().i18n.t("admin:user_login_token_exchange_failed"),
    );
  }

  await hydrateAuthSessionState();
  const role = useAuthSessionStore.getState().auth.role;
  if (!(role === "admin" || role === "owner")) {
    await authApi.signOut();
    clearAuthSessionState();
    throw new Error(getI18nRuntime().i18n.t("admin:user_login_unauthorized"));
  }

  return { token: null };
}

/**
 * Admin logout: sign out -> clear state -> reload.
 */
export async function adminLogout() {
  await authApi.signOut();
  useAuthSessionStore.getState().reset();
  clearAuthSessionState();
  qc.removeQueries({ queryKey: authKeys.all() });
  qc.removeQueries({ queryKey: userKeys.all() });
  if (typeof window !== "undefined") {
    setTimeout(() => location.reload(), 500);
  }
}
