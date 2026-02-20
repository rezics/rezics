import {userApi} from '@package/api/user/user.api';
import {setToken, removeToken} from '@package/api/react-query/http';
import type {CreateUser} from '@package/contract';

export const login = async (email: string, password: string) => {
  const {user, token} = await userApi.login({email, password});
  setToken(token);
  if (!user || !token) {
    throw new Error('Login failed');
  }
  return {user, token};
};

export const register = async (
  slug: string,
  email: string,
  password: string,
  verificationCode?: string,
  avatar?: string,
  bio?: string,
) => {
  try {
    const input: CreateUser = {
      email,
      verificationCode,
      password,
      slug,
      avatar,
      bio,
    };
    const {user, token} = await userApi.register(input);
    setToken(token);
    return {user, token};
  } catch (error) {
    console.error('Error during registration:', error);
    throw error;
  }
};

export const logout = (disableReload = false) => {
  removeToken();
  if (typeof window === 'undefined') return;
  localStorage.removeItem('user-store');
  if (!disableReload) {
    setTimeout(() => location.reload(), 500);
  }
};
