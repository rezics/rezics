import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const TestPage03 = lazyRouteComponent(
  () => import('@/page/Test/TestPage03'),
  'TestPage03',
);

export const Route = createFileRoute('/_mainLayout/test03')({
  component: TestPage03,
});
