import {createFileRoute, redirect} from '@tanstack/react-router';

import {authApi} from '@package/api/auth/auth.api';

import LoginPage from '@/user/page/LoginPage';

function normalizeRedirect(to?: string) {
  if (!to) return '/';
  // Only allow internal redirects.
  if (to.startsWith('/') && !to.startsWith('//')) return to;
  return '/';
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  beforeLoad: async ({search}) => {
    try {
      await authApi.getSession();
      // Already authenticated — redirect away from login
      throw redirect({to: normalizeRedirect(search.redirect), replace: true});
    } catch (e) {
      // If it's a redirect, re-throw it
      if (e instanceof Error === false) throw e;
      // Otherwise not authenticated — show login page
    }
  },
  component: LoginPage,
});
