import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const TagUnitPage = lazyRouteComponent(
  () => import('@/tag/page/TagUnitPage'),
  'TagUnitPage',
);

export const Route = createFileRoute('/_mainLayout/tag/$unitId')({
  component: TagUnitPage,
});
