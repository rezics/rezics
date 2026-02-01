import {createFileRoute, Outlet} from '@tanstack/react-router';

export const Route = createFileRoute('/_mainLayout/tag/book/$bookId/tag')({
  component: Outlet,
});
