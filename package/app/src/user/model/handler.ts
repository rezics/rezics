import {authApi} from '@package/api/auth/auth.api';
import {userApi} from '@package/api/user/user.api';
import {useAuthStore} from '@/user/state/authStore';
import {useUserProfileStore} from '@/user/state/userProfileStore';

async function loadProfile() {
  const user = await userApi.me();
  useUserProfileStore.getState().setUser(user);
  return user;
}

export const login = async (email: string, password: string) => {
  const result = await authApi.signIn({email, password});
  const token = result.token ?? result.session?.token ?? null;
  if (!token) {
    throw new Error('Login failed');
  }
  useAuthStore.getState().setToken(token);
  const user = await loadProfile();
  return {user, token};
};

export const register = async (
  slug: string,
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
      slug,
    });
    const token = result.token ?? result.session?.token ?? null;
    if (!token) {
      throw new Error('Registration failed');
    }
    useAuthStore.getState().setToken(token);
    const user = await loadProfile();
    return {user, token};
  } catch (error) {
    console.error('Error during registration:', error);
    throw error;
  }
};

export const logout = async (disableReload = false) => {
  await authApi.signOut();
  useAuthStore.getState().clearAuth();
  useUserProfileStore.getState().clearProfile();
  if (typeof window === 'undefined') return;
  if (!disableReload) {
    setTimeout(() => location.reload(), 500);
  }
};
