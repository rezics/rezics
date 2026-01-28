import {queryOptions} from '@tanstack/react-query';
import {userApi} from './user.api';
import {userKeys} from './user.keys';

export const userMeQuery = () =>
  queryOptions({
    queryKey: userKeys.meDetail(),
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

export const userAdminListQuery = (query?: Record<string, unknown>) =>
  queryOptions({
    queryKey: userKeys.adminList(query),
    queryFn: () => userApi.adminList(query),
    staleTime: 1000 * 60 * 1,
  });

export const userDetailQuery = (unitId: string) =>
  queryOptions({
    queryKey: userKeys.detail(unitId),
    queryFn: () => userApi.get(unitId),
    enabled: !!unitId,
    staleTime: 1000 * 60 * 10,
  });

export const userAdminDetailQuery = (unitId: string) =>
  queryOptions({
    queryKey: userKeys.adminDetail(unitId),
    queryFn: () => userApi.adminGet(unitId),
    enabled: !!unitId,
    staleTime: 1000 * 60 * 2,
  });

export const userFollowersQuery = (
  unitId: string,
  query?: {page?: number; limit?: number},
) =>
  queryOptions({
    queryKey: userKeys.followers(unitId, query),
    queryFn: () => userApi.getFollowers(unitId, query),
    enabled: !!unitId,
  });

export const userFollowingsQuery = (
  unitId: string,
  query?: {page?: number; limit?: number},
) =>
  queryOptions({
    queryKey: userKeys.followings(unitId, query),
    queryFn: () => userApi.getFollowings(unitId, query),
    enabled: !!unitId,
  });

export const userFollowStatusQuery = (targetIds: string[]) =>
  queryOptions({
    queryKey: userKeys.followStatus(targetIds),
    queryFn: () => userApi.getFollowStatus(targetIds),
    enabled: targetIds.length > 0,
  });

export const userQueries = {
  me: userMeQuery,
  jwtPayload: userJwtPayloadQuery,
  list: userListQuery,
  adminList: userAdminListQuery,
  detail: userDetailQuery,
  adminDetail: userAdminDetailQuery,
  followers: userFollowersQuery,
  followings: userFollowingsQuery,
  followStatus: userFollowStatusQuery,
};
