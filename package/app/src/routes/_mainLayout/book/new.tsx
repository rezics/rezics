import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const NewBookPage = lazyRouteComponent(
  () => import('@/page/BookEdit/NewBookPage'),
  'NewBookPage',
);

export const Route = createFileRoute('/_mainLayout/book/new')({
  component: NewBookPage,
});
