/**
 * React Query configurations for Feedback queries
 */

import {queryOptions} from '@tanstack/react-query';
import {feedbackApi} from './feedback.api';
import {feedbackKeys} from './feedback.keys';
import type {FeedbackFilters} from './feedback.types';

/**
 * Query options for listing all feedbacks (admin)
 */
export const feedbackListQuery = (filters?: FeedbackFilters) =>
  queryOptions({
    queryKey: feedbackKeys.list(filters),
    queryFn: () => feedbackApi.list(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for current user's feedback list
 */
export const myFeedbackListQuery = (filters?: FeedbackFilters) =>
  queryOptions({
    queryKey: feedbackKeys.my(filters),
    queryFn: () => feedbackApi.listMy(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for feedbacks by userId
 */
export const feedbacksByUserQuery = (
  userId: string,
  filters?: FeedbackFilters,
) =>
  queryOptions({
    queryKey: feedbackKeys.byUser(userId, filters),
    queryFn: () => feedbackApi.listByUser(userId, filters),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for getting a single feedback by id
 */
export const feedbackDetailQuery = (id: string) =>
  queryOptions({
    queryKey: feedbackKeys.detail(id),
    queryFn: () => feedbackApi.get(id),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

/**
 * Combined query options export
 */
export const feedbackQueries = {
  list: feedbackListQuery,
  my: myFeedbackListQuery,
  byUser: feedbacksByUserQuery,
  detail: feedbackDetailQuery,
};
