import {t} from 'elysia';

export const adminStatsResponseSchema = t.Object({
  counts: t.Object({
    users: t.Number(),
    books: t.Number(),
    comments: t.Number(),
    unresolvedFeedback: t.Number(),
  }),
  health: t.Object({
    server: t.Union([t.Literal('ok'), t.Literal('degraded')]),
    meili: t.Union([t.Literal('ok'), t.Literal('unreachable')]),
  }),
  contentTrend: t.Array(
    t.Object({
      date: t.String(),
      books: t.Number(),
      comments: t.Number(),
    }),
  ),
});

export type AdminStatsResponse =
  (typeof adminStatsResponseSchema)['static'];
