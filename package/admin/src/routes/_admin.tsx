import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

import AdminLayout from '@/layout/AdminLayout';
import { getToken } from '@package/api/react-query/http';

export const Route = createFileRoute('/_admin')({
  beforeLoad: ({ location }) => {
    // Protect all admin routes.
    // If unauthenticated, redirect to /login and remember the attempted path.
    if (!getToken()) {
      const attempted =
        typeof (location as any)?.pathname === 'string'
          ? `${(location as any).pathname ?? ''}${(location as any).searchStr ?? ''}${(location as any).hash ?? ''}`
          : typeof (location as any)?.href === 'string'
            ? (location as any).href
            : '/';
      throw redirect({
        to: '/login',
        search: { redirect: attempted },
        replace: true,
      });
    }
  },
  component: () => (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  ),
});

