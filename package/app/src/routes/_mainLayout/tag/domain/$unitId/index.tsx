import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const TagDomainPage = lazyRouteComponent(
  () => import('@/page/Tag/TagDomain'),
  'TagDomainPage',
);

export const Route = createFileRoute('/_mainLayout/tag/domain/$unitId/')({
  component: TagDomainPage,
});
