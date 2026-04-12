import { authApi } from "@rezics/api/auth/auth.api";
import { authKeys } from "@rezics/api/auth/auth.keys";
import {
  clearAllTokens,
  ensureAuthIdentityToken,
  parseJwt,
} from "@rezics/api/react-query/jwt";
import { userKeys } from "@rezics/api/user/user.keys";
import {
  clearAuthSessionState,
  hydrateAuthSessionState,
  useAuthSessionStore,
} from "@rezics/app-shell";
import { qc } from "@/app/provider/reactQueryUtil";

/**
 * Admin login: sign in -> verify admin role -> hydrate session.
 */
export async function adminLogin(email: string, password: string) {
  await authApi.signIn({ email, password });
  const token = await ensureAuthIdentityToken({ requirePresence: false });

  const claims = parseJwt(token);
  if (!(claims?.role === "admin" || claims?.role === "owner")) {
    throw new Error("You are not authorized to access this page");
  }

  await hydrateAuthSessionState();

  return { token };
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
