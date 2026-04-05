import {createFileRoute, lazyRouteComponent, redirect} from '@tanstack/react-router';
import {getToken, parseJwt} from '@rezics/api/react-query/jwt';
import {NormalizedTokenName} from '@rezics/contract';

const AuthJwtServicesPage = lazyRouteComponent(
  () => import('@/auth-jwt-service/page/AuthJwtServicesPage'),
  'AuthJwtServicesPage',
);

export const Route = createFileRoute('/_admin/auth/jwt-services')({
  beforeLoad: () => {
    const token = getToken(NormalizedTokenName.AUTH_IDENTITY);
    const role = token ? parseJwt(token)?.role : null;
    if (role !== 'owner') {
      throw redirect({to: '/', replace: true});
    }
  },
  component: AuthJwtServicesPage,
});
