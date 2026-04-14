import { t } from 'elysia';
import {
  addRealmFieldInputSchema,
  BasicAdminPermission,
  scoreAggregateDTOSchema,
  scoreEntryDTOSchema,
  scoreRealmFieldDTOSchema,
  upsertScoreInputSchema,
} from '@rezics/contract';
import { Elysia, status } from 'elysia';
import { authMacro, verifyAdminFromDb } from '@/middleware';
import {
  mapScoreAggregateToDTO,
  mapScoreEntryToDTO,
  mapScoreRealmFieldToDTO,
} from './score.mapper';
import { scoreService } from './score.service';

export const scoreApi = new Elysia({ prefix: '/score' })
  .use(authMacro)

  // POST /score — upsert score (auth required)
  .post(
    '/',
    async ({ body, identity }) => {
      const entry = await scoreService.upsertScore(
        identity.unitId,
        body.unitId,
        body.realm,
        body.value,
        body.fields,
      );
      return mapScoreEntryToDTO(entry);
    },
    {
      requireLogin: true,
      body: upsertScoreInputSchema,
      detail: { summary: 'Upsert score', tags: ['Score'] },
    },
  )

  // DELETE /score/:id — delete score (auth required)
  .delete(
    '/:id',
    async ({ params, identity, set }) => {
      const isAdmin = BasicAdminPermission(identity.permission);
      try {
        await scoreService.deleteScore(params.id, isAdmin);
        return { message: 'Score deleted' };
      } catch (err: any) {
        if (err.status === 409) {
          set.status = 409;
          return { error: 'Cannot delete score with linked reviews', blockingIds: err.blockingIds };
        }
        throw err;
      }
    },
    {
      requireLogin: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: 'Delete score', tags: ['Score'] },
    },
  )

  // GET /score/unit/:unitId — all realm aggregates for a unit
  .get(
    '/unit/:unitId',
    async ({ params }) => {
      const aggregates = await scoreService.getAggregatesByUnit(params.unitId);
      return aggregates.map(mapScoreAggregateToDTO);
    },
    {
      params: t.Object({ unitId: t.String() }),
      detail: { summary: 'Get all realm aggregates for a unit', tags: ['Score'] },
    },
  )

  // GET /score/unit/:unitId/:realm — single realm aggregate
  .get(
    '/unit/:unitId/:realm',
    async ({ params }) => {
      const aggregate = await scoreService.getAggregate(params.unitId, params.realm);
      return aggregate ? mapScoreAggregateToDTO(aggregate) : null;
    },
    {
      params: t.Object({ unitId: t.String(), realm: t.String() }),
      detail: { summary: 'Get single realm aggregate', tags: ['Score'] },
    },
  )

  // GET /score/user/:userId/:unitId — user's score entries for a unit
  .get(
    '/user/:userId/:unitId',
    async ({ params }) => {
      const entries = await scoreService.getUserScores(params.userId, params.unitId);
      return entries.map(mapScoreEntryToDTO);
    },
    {
      params: t.Object({ userId: t.String(), unitId: t.String() }),
      detail: { summary: "Get user's scores for a unit", tags: ['Score'] },
    },
  )

  // POST /score/recalculate — admin recalculation endpoint
  .post(
    '/recalculate',
    async ({ body, identity }) => {
      if (identity.permission.role !== "ADMIN" && identity.permission.role !== "ROOT") {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.unitId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      const aggregate = await scoreService.recalculateAggregate(body.unitId, body.realm);
      return aggregate ? mapScoreAggregateToDTO(aggregate) : { message: 'No entries, aggregate deleted' };
    },
    {
      requireLogin: true,
      body: t.Object({ unitId: t.String(), realm: t.String() }),
      detail: { summary: 'Recalculate aggregate (admin)', tags: ['Score'] },
    },
  )

  // GET /score/realm/:realmId — list realm fields
  .get(
    '/realm/:realmId',
    async ({ params }) => {
      const fields = await scoreService.listRealmFields(params.realmId);
      return fields.map(mapScoreRealmFieldToDTO);
    },
    {
      params: t.Object({ realmId: t.String() }),
      detail: { summary: 'List realm fields', tags: ['Score'] },
    },
  )

  // POST /score/realm/:realmId — add field (admin)
  .post(
    '/realm/:realmId',
    async ({ params, body, identity }) => {
      if (identity.permission.role !== "ADMIN" && identity.permission.role !== "ROOT") {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.unitId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      const field = await scoreService.addRealmField(
        params.realmId,
        body.key,
        body.label,
        body.sortOrder,
      );
      return mapScoreRealmFieldToDTO(field);
    },
    {
      requireLogin: true,
      params: t.Object({ realmId: t.String() }),
      body: addRealmFieldInputSchema,
      detail: { summary: 'Add realm field (admin)', tags: ['Score'] },
    },
  )

  // DELETE /score/realm/:realmId/:key — remove field (admin)
  .delete(
    '/realm/:realmId/:key',
    async ({ params, identity, set }) => {
      if (identity.permission.role !== "ADMIN" && identity.permission.role !== "ROOT") {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.unitId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      try {
        await scoreService.removeRealmField(params.realmId, params.key);
        return { message: 'Field removed' };
      } catch (err: any) {
        if (err.status === 404) {
          set.status = 404;
          return { error: err.message };
        }
        throw err;
      }
    },
    {
      requireLogin: true,
      params: t.Object({ realmId: t.String(), key: t.String() }),
      detail: { summary: 'Remove realm field (admin)', tags: ['Score'] },
    },
  );
