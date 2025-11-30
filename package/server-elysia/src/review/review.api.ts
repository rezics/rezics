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
  hasPermissionToDeleteReview,
  hasPermissionToUpdateReview,
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
    async ({body, headers, jwt, set, query}): Promise<ReviewResponse> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const unitType = query.unitType ?? UnitType.REVIEW;
      const req: CreateReviewInput = {
        ...body,
        userId: payload.unitId,
      } as CreateReviewInput;
      const review = await reviewService.create(req, {
        unitType: unitType as UnitType,
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
      const target = await reviewService.getById(params.id);
      if (!hasPermissionToUpdateReview(payload as any, target as any)) {
        set.status = 403;
        throw new Error(
          'Forbidden: you do not have permission to update this review',
        );
      }
      const review = await reviewService.update(params.id, body);
      return mapReviewToDTO(review);
    },
    {
      params: reviewParamsSchema,
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
    }: {
      params: {id: string};
      headers: {authorization?: string};
      jwt: any;
      set: any;
      query: reviewQuerySchemaType;
    }): Promise<{message: string}> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const target = await reviewService.getById(params.id);
      if (!hasPermissionToDeleteReview(payload as any, target as any)) {
        set.status = 403;
        throw new Error(
          'Forbidden: you do not have permission to delete this review',
        );
      }
      await reviewService.delete(params.id);
      return {message: 'Review deleted successfully'};
    },
    {
      params: reviewParamsSchema,
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
