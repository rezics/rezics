import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

export const Route = createFileRoute('/_admin/books')({
  component: lazyRouteComponent(() => import('@/page/BooksPage'), 'default'),
});

