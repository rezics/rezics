import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const QuoteByBookPage = lazyRouteComponent(
  () => import('@/page/Review/QuoteByBookPage'),
  'QuoteByBookPage',
);

export const Route = createFileRoute('/_mainLayout/quote/book/$bookId')({
  component: QuoteByBookPage,
});
