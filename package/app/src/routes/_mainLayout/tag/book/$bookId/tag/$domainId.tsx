import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const TagByBookFullPage = lazyRouteComponent(
  () => import('@/page/Tag/TagByUnitPage'),
  'TagByBookFullPage',
);

export const Route = createFileRoute('/_mainLayout/tag/book/$bookId/tag/$domainId')({
  component: TagByBookFullPage,
});

