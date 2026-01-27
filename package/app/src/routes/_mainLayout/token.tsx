import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const TokenPage = lazyRouteComponent(() => import('@/page/Token/TokenPage'), 'TokenPage');

export const Route = createFileRoute('/_mainLayout/token')({
  component: TokenPage,
});

