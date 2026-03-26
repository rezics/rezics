import {createFileRoute, Outlet, redirect} from '@tanstack/react-router';

import AdminLayout from '@/core/layout/AdminLayout';
import {getToken, parseJwt} from '@package/api/react-query/jwt';

export const Route = createFileRoute('/_admin')({
  beforeLoad: async ({location}) => {
    try {
      const token = getToken();
      const claims = parseJwt(token);
      if (!(claims?.role === 'admin' || claims?.role === 'owner')) {
        throw new Error(
          'Unauthorized, only admins and owners can access this page',
        );
      }
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
