import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const TestPage = lazyRouteComponent(() => import('@/playground/page/TestPage'));

export const Route = createFileRoute('/_mainLayout/test')({
  component: TestPage,
});
