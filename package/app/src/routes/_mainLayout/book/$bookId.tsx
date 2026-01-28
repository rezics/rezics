import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

const BookPageContainer = lazyRouteComponent(
  () => import('@/page/Book/BookPage'),
  'BookPageContainer',
);

export const Route = createFileRoute('/_mainLayout/book/$bookId')({
  component: () => (
    <BookPageContainer />
  )
});

