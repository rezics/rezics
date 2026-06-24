import { authApi } from "@rezics/contract/api/auth/auth.api";
import { authKeys } from "@rezics/contract/api/auth/auth.keys";
import { exchangeForSessionToken } from "@rezics/contract/api/react-query/jwt";
import { userKeys } from "@rezics/contract/api/user/user.keys";
import { qc } from "@/app";
import {
  clearAuthSessionState,
  hydrateAuthSessionState,
  useAuthSessionStore,
  useUserProfileStore,
} from "@/user/states";

export const login = async (email: string, password: string) => {
  await authApi.signIn({ email, password });
  await exchangeForSessionToken();
  await hydrateAuthSessionState({ requirePresence: false });
  return { token: null };
};

export const register = async (
  email: string,
  password: string,
  avatar?: string,
  summary?: string,
) => {
  try {
    void avatar;
    void summary;
    await authApi.signUp({ email, password });
    await hydrateAuthSessionState({ requirePresence: false });
    return { token: null };
  } catch (error) {
    console.error("Error during registration:", error);
    throw error;
  }
};

export const logout = async (disableReload = false) => {
  await authApi.signOut();
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
