import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const NewReadListPage = lazyRouteComponent(
  () => import('@/readlist/page/NewReadListPage'),
  'NewReadListPage',
);

export const Route = createFileRoute('/_mainLayout/readlist/new')({
  component: NewReadListPage,
});
