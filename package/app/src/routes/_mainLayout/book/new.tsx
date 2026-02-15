import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const NewBookPage = lazyRouteComponent(
  () => import('@/book-edit'),
  'NewBookPage',
);

export const Route = createFileRoute('/_mainLayout/book/new')({
  component: NewBookPage,
});
