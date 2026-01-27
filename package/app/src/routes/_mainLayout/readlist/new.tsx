import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const NewReadListPage = lazyRouteComponent(
  () => import('@/page/ReadList/NewReadListPage'),
  'NewReadListPage',
);

export const Route = createFileRoute('/_mainLayout/readlist/new')({
  component: NewReadListPage,
});

