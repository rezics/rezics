import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const NewBookPage = lazyRouteComponent(
  () => import('@feature/book/edit'),
  'NewBookPage',
);

export const Route = createFileRoute('/_mainLayout/book/new')({
  component: NewBookPage,
});
