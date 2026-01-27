import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

const BookLibContainer = lazyRouteComponent(
  () => import('@/page/Book/BookLibPage'),
  'BookLibContainer',
);

export const Route = createFileRoute('/_mainLayout/book/')({
  component: BookLibContainer,
});

