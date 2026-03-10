import {authApi} from '@package/api/auth/auth.api';
import {authKeys} from '@package/api/auth/auth.keys';
import {userKeys} from '@package/api/user/user.keys';
import {qc} from '@/app/provider/reactQueryUtil';
import {userApi} from '@package/api/user/user.api';
import {
  clearAuthSessionState,
  hydrateAuthSessionState,
  useAuthSessionStore,
  useAuthStore,
  useUserProfileStore,
} from '@/user/state';

async function loadProfile() {
  const user = await userApi.me();
  useUserProfileStore.getState().setUser(user);
  return user;
}

export const login = async (email: string, password: string) => {
  const result = await authApi.signIn({email, password});
  const token = result.token ?? result.session?.token ?? null;
  if (token) {
    useAuthStore.getState().setToken(token);
  } else {
    useAuthStore.getState().clearAuth();
  }

  const sessionState = await hydrateAuthSessionState();
  const hasAuthSession = Boolean(sessionState?.session?.id);

  if (!token && !hasAuthSession) {
    throw new Error('Login failed');
  }
  const shouldLoadProfile = useAuthSessionStore.getState().hasBusinessToken;
  const user = shouldLoadProfile ? await loadProfile() : null;
  if (!shouldLoadProfile) {
    useUserProfileStore.getState().clearProfile();
  }
  return {user, token};
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
    const result = await authApi.signUp({
      email,
      password,
    });
    const token = result.token ?? result.session?.token ?? null;
    if (token) {
      useAuthStore.getState().setToken(token);
    } else {
      useAuthStore.getState().clearAuth();
    }

    const sessionState = await hydrateAuthSessionState();
    const hasAuthSession = Boolean(sessionState?.session?.id);

    if (!token && !hasAuthSession) {
      throw new Error('Registration failed');
    }
    const shouldLoadProfile = useAuthSessionStore.getState().hasBusinessToken;
    const user = shouldLoadProfile ? await loadProfile() : null;
    if (!shouldLoadProfile) {
      useUserProfileStore.getState().clearProfile();
    }
    return {user, token};
  } catch (error) {
    console.error('Error during registration:', error);
    throw error;
  }
};

export const logout = async (disableReload = false) => {
  await authApi.signOut();
  useAuthStore.getState().clearAuth();
  clearAuthSessionState();
  useUserProfileStore.getState().clearProfile();
  qc.removeQueries({queryKey: authKeys.all()});
  qc.removeQueries({queryKey: userKeys.all()});
  if (typeof window === 'undefined') return;
  if (!disableReload) {
    setTimeout(() => location.reload(), 500);
  }
};
