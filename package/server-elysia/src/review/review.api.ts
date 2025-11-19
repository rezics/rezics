import {coreInstance} from '../core';
import {verifyAuth} from '@/src/utils/authUtils';
import {UnitType} from '@/prisma/client';
import {
  createReviewSchema,
  updateReviewSchema,
  reviewListQuerySchema,
  reviewParamsSchema,
  type ReviewListResponse,
  type ReviewResponse,
  type CreateReviewInput,
  reviewQuerySchema,
  type reviewQuerySchemaType,
} from '@package/contract';
import {reviewService} from './review.service';
import {mapReviewToDTO} from './mapper';
import {unitService} from '@/src/unit/unit.service';
import type {JWTPayload} from '../user';

export const reviewApi = coreInstance('/reviews')
  /**
   * List reviews with filters and pagination
   */
  .get(
    '/',
    async ({query}): Promise<ReviewListResponse> => {
      const {reviews, total} = await reviewService.list(query);
      return {reviews: reviews.map(mapReviewToDTO), total};
    },
    {
      query: reviewListQuerySchema,
      detail: {
        summary: 'Get all reviews',
        description: 'Get all reviews with filters and pagination',
        tags: ['Reviews'],
      },
    },
  )
  /**
   * Get single review by id
   */
  .get(
    '/:id',
    async ({params, query}): Promise<ReviewResponse> => {
      const review = await reviewService.getById(params.id, {
        unitType: query.unitType as UnitType,
      });
      return mapReviewToDTO(review);
    },
    {
      params: reviewParamsSchema,
      query: reviewQuerySchema,
      detail: {
        summary: 'Get review',
        description: 'Get a single review by id',
        tags: ['Reviews'],
      },
    },
  )
  /**
   * Create review
   */
  .post(
    '/',
    async ({body, headers, jwt, set}): Promise<ReviewResponse> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const req: CreateReviewInput = {
        ...body,
        userId: payload.unitId,
      } as CreateReviewInput;
      const review = await reviewService.create(req, {
        unitType: UnitType.REVIEW,
      });
      return mapReviewToDTO(review);
    },
    {
      body: createReviewSchema,
      detail: {
        summary: 'Create review',
        description: 'Create a new review for a book',
        tags: ['Reviews'],
      },
    },
  )
  /**
   * Update review
   */
  .put(
    '/:id',
    async ({
      params,
      body,
      query,
      headers,
      jwt,
      set,
    }: {
      params: {id: string};
      body: import('@package/contract').UpdateReviewInput;
      query: reviewQuerySchemaType;
      headers: {authorization?: string};
      jwt: any;
      set: any;
    }): Promise<ReviewResponse> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const unitType = query.unitType ?? UnitType.REVIEW;
      await ensureReviewOwnership(
        params.id,
        unitType as UnitType,
        payload.unitId,
        set,
        payload,
      );
      const review = await reviewService.update(params.id, body, {
        unitType: unitType as UnitType,
      });
      return mapReviewToDTO(review);
    },
    {
      params: reviewParamsSchema,
      query: reviewQuerySchema,
      body: updateReviewSchema,
      detail: {
        summary: 'Update review',
        description: 'Update an existing review by id',
        tags: ['Reviews'],
      },
    },
  )
  /**
   * Delete review
   */
  .delete(
    '/:id',
    async ({
      params,
      headers,
      jwt,
      set,
      query,
    }: {
      params: {id: string};
      headers: {authorization?: string};
      jwt: any;
      set: any;
      query: reviewQuerySchemaType;
    }): Promise<{message: string}> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const unitType = query.unitType ?? UnitType.REVIEW;
      await ensureReviewOwnership(
        params.id,
        unitType as UnitType,
        payload.unitId,
        set,
      );
      await reviewService.delete(params.id, {unitType: unitType as UnitType});
      return {message: 'Review deleted successfully'};
    },
    {
      params: reviewParamsSchema,
      query: reviewQuerySchema,
      detail: {
        summary: 'Delete review',
        description: 'Delete a review by id',
        tags: ['Reviews'],
      },
    },
  )
  /**
   * List short reviews (UnitType.REMARK)
   */
  .get(
    '/short',
    async ({query}): Promise<ReviewListResponse> => {
      const {reviews, total} = await reviewService.list(query, {
        unitType: UnitType.REMARK,
      });
      return {reviews: reviews.map(mapReviewToDTO), total};
    },
    {
      query: reviewListQuerySchema,
      detail: {
        summary: 'Get all short reviews',
        description: 'List short-form reviews (UnitType.REMARK)',
        tags: ['Short Reviews'],
      },
    },
  )
  /**
   * Get single short review
   */
  .get(
    '/remark/:id',
    async ({params}): Promise<ReviewResponse> => {
      const review = await reviewService.getById(params.id, {
        unitType: UnitType.REMARK,
      });
      return mapReviewToDTO(review);
    },
    {
      params: reviewParamsSchema,
      detail: {
        summary: 'Get short review',
        description: 'Get a single short review by id',
        tags: ['Short Reviews'],
      },
    },
  );

async function ensureReviewOwnership(
  reviewId: string,
  expectedType: UnitType,
  ownerId: string,
  set: {status?: number | string},
  payload?: JWTPayload,
): Promise<void> {
  if (payload?.permission?.role?.includes('ADMIN')) {
    return;
  }
  const target = await unitService.getByUnitId(reviewId).catch(() => {
    set.status = 404;
    throw new Error(`Review not found: ${reviewId}`);
  });

  if (!target || target.type !== expectedType) {
    set.status = 404;
    throw new Error(`Review not found: ${reviewId}`);
  }

  if (target.userId !== ownerId) {
    set.status = 403;
    throw new Error('Forbidden: you do not have permission');
  }
}
