import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const JwtServicesPage = lazyRouteComponent(
  () => import('@/jwt-service/page/JwtServicesPage'),
  'JwtServicesPage',
);

export const Route = createFileRoute('/_admin/jwt-services')({
  component: JwtServicesPage,
});
