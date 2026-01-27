import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const TestPage02 = lazyRouteComponent(() => import('@/page/Test/TestPage02'), 'TestPage02');

export const Route = createFileRoute('/_mainLayout/test02')({
  component: TestPage02,
});

