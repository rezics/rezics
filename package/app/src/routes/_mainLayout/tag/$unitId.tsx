import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const TagUnitPage = lazyRouteComponent(() => import('@/page/Tag/TagUnitPage'), 'TagUnitPage');

export const Route = createFileRoute('/_mainLayout/tag/$unitId')({
  component: TagUnitPage,
});

