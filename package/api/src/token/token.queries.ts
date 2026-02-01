/**
 * React Query configurations for Token queries
 */

import {queryOptions} from '@tanstack/react-query';
import {tokenApi} from './token.api';
import {tokenKeys} from './token.keys';

/**
 * Query options for listing tokens of the current user
 */
export const tokenListQuery = () =>
  queryOptions({
    queryKey: tokenKeys.list(),
    queryFn: () => tokenApi.list(),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

/**
 * Combined token query exports
 */
export const tokenQueries = {
  list: tokenListQuery,
};
