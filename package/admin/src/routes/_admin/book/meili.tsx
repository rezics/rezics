import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

export const Route = createFileRoute('/_admin/book/meili')({
  component: lazyRouteComponent(
    () => import('@/page/Book/MeiliBooksPage'),
    'default',
  ),
})
