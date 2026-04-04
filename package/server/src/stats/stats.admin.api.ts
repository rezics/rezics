import {Elysia} from 'elysia';
import {adminStatsResponseSchema} from '@rezics/contract';
import {authMacro} from '@/middleware/permission';
import {statsService} from './stats.service';

export const statsAdminApi = new Elysia({prefix: '/admin/stats'})
  .use(authMacro)
  .get(
    '/',
    async () => {
      return statsService.getStats();
    },
    {
      requireAdmin: true,
      response: adminStatsResponseSchema,
      detail: {
        summary: 'Get admin dashboard stats',
        description:
          'Returns aggregate counts, system health, and content trend for the admin dashboard',
        tags: ['Admin', 'Stats'],
      },
    },
  );
