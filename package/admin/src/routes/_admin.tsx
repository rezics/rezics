import {createFileRoute, Outlet, redirect} from '@tanstack/react-router';

import AdminLayout from '@/core/layout/AdminLayout';
import {authApi} from '@package/api/auth/auth.api';

export const Route = createFileRoute('/_admin')({
  beforeLoad: async ({location}) => {
    // Protect all admin routes.
    // Check auth-server session instead of localStorage JWT.
    try {
      await authApi.getSession();
    } catch {
      const attempted =
        typeof (location as any)?.pathname === 'string'
          ? `${(location as any).pathname ?? ''}${
              (location as any).searchStr ?? ''
            }${(location as any).hash ?? ''}`
          : typeof (location as any)?.href === 'string'
            ? (location as any).href
            : '/';
      throw redirect({
        to: '/login',
        search: {redirect: attempted},
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
