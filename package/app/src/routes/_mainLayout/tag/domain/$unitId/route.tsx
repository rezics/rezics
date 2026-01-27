import {createFileRoute, Outlet} from '@tanstack/react-router';

export const Route = createFileRoute('/_mainLayout/tag/domain/$unitId')({
  component: Outlet,
});

