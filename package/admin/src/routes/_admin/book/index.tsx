import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

export const Route = createFileRoute('/_admin/book/')({
  component: lazyRouteComponent(
    () => import('@/page/Book/BooksPage'),
    'default',
  ),
});
