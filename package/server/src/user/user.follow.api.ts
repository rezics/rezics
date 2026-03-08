import type {UserDTO} from '@package/contract';
import {userService} from './user.service';
import {mapUserToPublicProfile} from './mapper';

import {verifyAuth} from './utils';

import {userParamsSchema} from '@package/contract';
import {t} from 'elysia';
import {coreInstance} from '../core';

export const followRoute = (api: ReturnType<typeof coreInstance>) => {
  return (
    api
      /**
       * Follow a user
       * POST /users/follow/:targetId
       */
      .post(
        '/follow/:targetId',
        async ({headers, params, set}) => {
          const payload = await verifyAuth(headers.authorization, set);
          await userService.follow(payload.unitId, params.targetId);
          return {message: 'Followed successfully'};
        },
        {
          params: t.Object({
            targetId: t.String(),
          }),
          detail: {
            summary: 'Follow user',
            description: 'Follow a user',
            tags: ['Users', 'Follow'],
          },
        },
      )

      /**
       * Unfollow a user
       * DELETE /users/follow/:targetId
       */
      .delete(
        '/follow/:targetId',
        async ({headers, params, set}) => {
          const payload = await verifyAuth(headers.authorization, set);
          await userService.unfollow(payload.unitId, params.targetId);
          return {message: 'Unfollowed successfully'};
        },
        {
          params: t.Object({
            targetId: t.String(),
          }),
          detail: {
            summary: 'Unfollow user',
            description: 'Unfollow a user',
            tags: ['Users', 'Follow'],
          },
        },
      )

      /**
       * Get follow status for current user
       * GET /users/follow/status?targetIds=...
       */
      .get(
        '/follow/status',
        async ({headers, query, set}) => {
          const payload = await verifyAuth(headers.authorization, set);
          const {targetIds} = query;

          let ids: string[] = [];
          if (targetIds) {
            ids = Array.isArray(targetIds) ? targetIds : [targetIds];
          }

          const status = await userService.getFollowStatus(payload.unitId, ids);
          return status;
        },
        {
          query: t.Object({
            targetIds: t.Optional(t.Union([t.String(), t.Array(t.String())])),
          }),
          detail: {
            summary: 'Get follow status',
            description: 'Check if current user follows specified targets',
            tags: ['Users', 'Follow'],
          },
        },
      )

      .get(
        '/follow/summary',
        async ({headers, query, set}) => {
          await verifyAuth(headers.authorization, set);
          const {targetIds} = query;

          let ids: string[] = [];
          if (targetIds) {
            ids = Array.isArray(targetIds) ? targetIds : [targetIds];
          }

          if (!ids.length) {
            return {
              targetIds: [],
              followers: {},
            } as {
              targetIds: string[];
              followers: Record<string, number>;
            };
          }

          const followers = await userService.getFollowSummary(ids);
          return {
            targetIds: ids,
            followers,
          } as {
            targetIds: string[];
            followers: Record<string, number>;
          };
        },
        {
          query: t.Object({
            targetIds: t.Optional(t.Union([t.String(), t.Array(t.String())])),
          }),
          detail: {
            summary: 'Get follow summary',
            description: 'Get follower counts for one or many target users',
            tags: ['Users', 'Follow'],
          },
        },
      )

      /**
       * Get followers of a user
       * GET /users/:unitId/followers
       */
      .get(
        '/:unitId/followers',
        async ({params, query}) => {
          const {users, total} = await userService.getFollowers(
            params.unitId,
            query,
          );
          return {users: users.map(mapUserToPublicProfile), total};
        },
        {
          params: userParamsSchema,
          query: t.Object({
            page: t.Optional(t.Numeric()),
            limit: t.Optional(t.Numeric()),
          }),
          detail: {
            summary: 'Get followers',
            description: 'Get followers of a user',
            tags: ['Users', 'Follow'],
          },
        },
      )

      /**
       * Get followings of a user
       * GET /users/:unitId/followings
       */
      .get(
        '/:unitId/followings',
        async ({params, query}) => {
          const {users, total} = await userService.getFollowings(
            params.unitId,
            query,
          );
          return {users: users.map(mapUserToPublicProfile), total};
        },
        {
          params: userParamsSchema,
          query: t.Object({
            page: t.Optional(t.Numeric()),
            limit: t.Optional(t.Numeric()),
          }),
          detail: {
            summary: 'Get followings',
            description: 'Get followings of a user',
            tags: ['Users', 'Follow'],
          },
        },
      )

      /**
       * Get user by unitId (public, returns public profile)
       * GET /users/:unitId
       */
      .get(
        '/:unitId',
        async ({params}): Promise<UserDTO> => {
          const user = await userService.getByUnitId(params.unitId);
          return mapUserToPublicProfile(user);
        },
        {
          params: userParamsSchema,
          detail: {
            summary: 'Get user',
            description: 'Get a single user by unit ID',
            tags: ['Users'],
          },
        },
      )
  );
};
