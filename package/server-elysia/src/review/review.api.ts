import {Elysia, t} from 'elysia';
import {coreInstance} from '../core';
import {verifyAuth} from '@/src/utils/authUtils';
import {
  createReviewSchema,
  updateReviewSchema,
  reviewListQuerySchema,
  reviewParamsSchema,
  type ReviewListResponse,
  type ReviewResponse,
  type CreateReviewInput,
} from '@package/contract';
import {reviewService} from './review.service';
import {mapReviewToDTO} from './mapper';
import {unitService} from '@/src/unit/unit.service';

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
    async ({params}): Promise<ReviewResponse> => {
      const review = await reviewService.getById(params.id);
      return mapReviewToDTO(review);
    },
    {
      params: reviewParamsSchema,
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
        userId: payload.userId,
      } as CreateReviewInput;
      const review = await reviewService.create(req);
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
    async ({params, body, headers, jwt, set}): Promise<ReviewResponse> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const target = await unitService.getByUnitId(params.id);
      if (!target) {
        set.status = 404;
        throw new Error(`Review not found: ${params.id}`);
      }
      if (target.userId !== payload.userId) {
        set.status = 403;
        throw new Error('Forbidden: you do not have permission to update');
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
    async ({params, headers, jwt, set}): Promise<{message: string}> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const target = await unitService.getByUnitId(params.id);
      if (!target) {
        set.status = 404;
        throw new Error(`Review not found: ${params.id}`);
      }
      if (target.userId !== payload.userId) {
        set.status = 403;
        throw new Error('Forbidden: you do not have permission to delete');
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
  );
