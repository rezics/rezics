import {queryOptions} from '@tanstack/react-query';
import {userApi} from './user.api';
import {userKeys} from './user.keys';

export const userMeQuery = (unitId: string) =>
  queryOptions({
    queryKey: userKeys.detail(unitId),
    queryFn: () => userApi.me(),
    staleTime: 1000 * 60 * 5,
  });

export const userJwtPayloadQuery = () =>
  queryOptions({
    queryKey: userKeys.detail('me-jwt-payload'),
    queryFn: () => userApi.jwtPayload(),
    staleTime: 1000 * 60 * 1,
  });

export const userListQuery = (query?: Record<string, unknown>) =>
  queryOptions({
    queryKey: userKeys.list(query),
    queryFn: () => userApi.list(query),
    staleTime: 1000 * 60 * 5,
  });

export const userDetailQuery = (unitId: string) =>
  queryOptions({
    queryKey: userKeys.detail(unitId),
    queryFn: () => userApi.get(unitId),
    enabled: !!unitId,
    staleTime: 1000 * 60 * 10,
  });

export const userQueries = {
  me: userMeQuery,
  jwtPayload: userJwtPayloadQuery,
  list: userListQuery,
  detail: userDetailQuery,
};
