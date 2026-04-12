import { authApi } from "@rezics/api/auth/auth.api";
import { authKeys } from "@rezics/api/auth/auth.keys";
import {
  clearAllTokens,
  ensureAuthIdentityToken,
} from "@rezics/api/react-query/jwt";
import { userKeys } from "@rezics/api/user/user.keys";
import { qc } from "@/app/provider/reactQueryUtil";
import {
  clearAuthSessionState,
  hydrateAuthSessionState,
  useAuthSessionStore,
  useUserProfileStore,
} from "@/user/state";

export const login = async (email: string, password: string) => {
  await authApi.signIn({ email, password });
  const token = await ensureAuthIdentityToken({ requirePresence: false });

  if (!token) {
    throw new Error("Login failed");
  }

  await hydrateAuthSessionState();

  return { token };
};

export const register = async (
  email: string,
  password: string,
  avatar?: string,
  bio?: string,
) => {
  try {
    void avatar;
    void bio;
    await authApi.signUp({ email, password });
    const token = await ensureAuthIdentityToken({ requirePresence: false });

    if (!token) {
      throw new Error("Registration failed");
    }

    await hydrateAuthSessionState();

    return { token };
  } catch (error) {
    console.error("Error during registration:", error);
    throw error;
  }
};

export const logout = async (disableReload = false) => {
  await authApi.signOut();
  clearAllTokens();
  clearAuthSessionState();
  useAuthSessionStore.getState().reset();
  useUserProfileStore.getState().clearProfile();
  qc.removeQueries({ queryKey: authKeys.all() });
  qc.removeQueries({ queryKey: userKeys.all() });
  if (typeof window === "undefined") return;
  if (!disableReload) {
    setTimeout(() => location.reload(), 500);
  }
};
