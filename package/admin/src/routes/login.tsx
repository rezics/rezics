import { createFileRoute, redirect } from '@tanstack/react-router';

import { getToken } from '@package/api/react-query/http';

import LoginPage from '@/page/Auth/LoginPage';

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
  beforeLoad: ({ search }) => {
    if (getToken()) {
      throw redirect({ to: normalizeRedirect(search.redirect), replace: true });
    }
  },
  component: LoginPage,
});

