import { authApi } from "@rezics/api/auth/auth.api";
import { authKeys } from "@rezics/api/auth/auth.keys";
import {
  clearAllTokens,
  exchangeForSessionToken,
} from "@rezics/api/react-query/jwt";
import {
  clearAuthSessionState,
  hydrateAuthSessionState,
  useAuthSessionStore,
} from "@rezics/api/states";
import { userKeys } from "@rezics/api/user/user.keys";
import { qc } from "@/app/providers/reactQueryUtil";

/**
 * Admin login: sign in -> verify admin role -> exchange for session token -> hydrate.
 */
export async function adminLogin(email: string, password: string) {
  await authApi.signIn({ email, password });

  const refreshed = await exchangeForSessionToken();
  if (!refreshed) {
    throw new Error("Login failed: token exchange failed");
  }

  await hydrateAuthSessionState();
  const role = useAuthSessionStore.getState().user?.role;
  if (!(role === "admin" || role === "owner")) {
    await authApi.signOut();
    clearAllTokens();
    clearAuthSessionState();
    throw new Error("You are not authorized to access this page");
  }

  return { token: null };
}

/**
 * Admin logout: sign out -> clear state -> reload.
 */
export async function adminLogout() {
  await authApi.signOut();
  clearAllTokens();
  useAuthSessionStore.getState().reset();
  clearAuthSessionState();
  qc.removeQueries({ queryKey: authKeys.all() });
  qc.removeQueries({ queryKey: userKeys.all() });
  if (typeof window !== "undefined") {
    setTimeout(() => location.reload(), 500);
  }
}
