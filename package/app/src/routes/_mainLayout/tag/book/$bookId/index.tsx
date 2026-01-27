import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const TagByBookPage = lazyRouteComponent(
  () => import('@/page/Tag/TagByUnitPage'),
  'TagByBookPage',
);

export const Route = createFileRoute('/_mainLayout/tag/book/$bookId/')({
  component: TagByBookPage,
});

