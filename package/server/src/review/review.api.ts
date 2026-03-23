import {Elysia} from 'elysia';
import {
  serverCorsPolicy,
  requireLogin,
  requireOwner,
  buildActorFromContext,
} from '@/src/middleware';
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
  hasPermissionToDeleteReview,
  hasPermissionToUpdateReview,
  BasicAdminPermission,
} from '@package/contract';
import {reviewService} from './review.service';
import {mapReviewToDTO} from './mapper';

export const reviewApi = new Elysia({prefix: '/reviews'})
  .use(serverCorsPolicy('credentialed'))
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
  )
  .use(requireLogin)
  .post(
    '/',
    async ({body, identity, query}): Promise<ReviewResponse> => {
      const unitType = query.unitType ?? UnitType.REVIEW;
      const req: CreateReviewInput = {
        ...body,
        userId: identity.unitId,
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
  .use(requireOwner)
  .get(
    '/',
    async ({query, currentUser, set}): Promise<ReviewListResponse> => {
      if (!BasicAdminPermission(currentUser)) {
        set.status = 403;
        throw new Error(
          'Forbidden: you do not have permission to get all reviews',
        );
      }
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
  .put(
    '/:id',
    async ({
      params,
      body,
      identity,
      currentUser,
      set,
    }): Promise<ReviewResponse> => {
      const target = await reviewService.getById(params.id);
      if (
        !hasPermissionToUpdateReview(
          buildActorFromContext({identity, currentUser}),
          target as any,
        )
      ) {
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
  .delete(
    '/:id',
    async ({
      params,
      identity,
      currentUser,
      set,
    }): Promise<{message: string}> => {
      const target = await reviewService.getById(params.id);
      if (
        !hasPermissionToDeleteReview(
          buildActorFromContext({identity, currentUser}),
          target as any,
        )
      ) {
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
  );
