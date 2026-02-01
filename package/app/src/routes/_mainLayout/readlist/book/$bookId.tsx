import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const ReadlistByBookPage = lazyRouteComponent(
  () => import('@/page/ReadList/ReadListsByBookPage'),
  'ReadlistByBookPage',
);

export const Route = createFileRoute('/_mainLayout/readlist/book/$bookId')({
  component: ReadlistByBookPage,
});
