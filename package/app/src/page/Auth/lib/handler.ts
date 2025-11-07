import {userApi} from '@/api/user/user';
import {setToken, removeToken} from '@/api/react-query/http';
import type {CreateUserInput} from '@package/contract';

export const login = async (email: string, password: string) => {
  const {user, token} = await userApi.login({email, password});
  setToken(token);
  if (!user || !token) {
    throw new Error('Login failed');
  }
  return {user, token};
};

export const register = async (
  name: string,
  email: string,
  password: string,
  avatar?: string,
  bio?: string,
) => {
  try {
    const input: CreateUserInput = {
      email,
      password,
      name,
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

export const logout = () => {
  removeToken();
  if (typeof window === 'undefined') return;
  localStorage.removeItem('user-store');
  window.location.href = '/login';
};
