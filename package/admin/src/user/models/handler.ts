import { authApi } from "@rezics/api/auth/auth.api";
import { authKeys } from "@rezics/api/auth/auth.keys";
import { exchangeForSessionToken } from "@rezics/api/react-query/jwt";
import {
  clearAuthSessionState,
  hydrateAuthSessionState,
  useAuthSessionStore,
} from "@rezics/api/states";
import { userKeys } from "@rezics/api/user/user.keys";
import { qc } from "@/app/providers/reactQueryUtil";
import {
  admin_user_login_token_exchange_failed,
  admin_user_login_unauthorized,
} from "@rezics/i18n/messages";

/**
 * Admin login: sign in -> verify admin role -> exchange for session token -> hydrate.
 */
export async function adminLogin(email: string, password: string) {
  await authApi.signIn({ email, password });

  const refreshed = await exchangeForSessionToken();
  if (!refreshed) {
    throw new Error(admin_user_login_token_exchange_failed());
  }

  await hydrateAuthSessionState();
  const role = useAuthSessionStore.getState().auth.role;
  if (!(role === "admin" || role === "owner")) {
    await authApi.signOut();
    clearAuthSessionState();
    throw new Error(admin_user_login_unauthorized());
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
