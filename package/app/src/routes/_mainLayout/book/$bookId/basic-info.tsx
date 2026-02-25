import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const BookBasicInfoPage = lazyRouteComponent(
  () => import('@/book-library'),
  'BookBasicInfoPage',
);

export const Route = createFileRoute('/_mainLayout/book/$bookId/basic-info')({
  component: BookBasicInfoPage,
});
