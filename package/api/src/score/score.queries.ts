import { queryOptions } from '@tanstack/react-query';
import { scoreApi } from './score.api';
import { scoreKeys } from './score.keys';

export const scoreAggregatesQuery = (unitId: string) =>
  queryOptions({
    queryKey: scoreKeys.aggregatesByUnit(unitId),
    queryFn: () => scoreApi.getAggregatesByUnit(unitId),
    staleTime: 1000 * 60 * 2,
  });

export const scoreAggregateQuery = (unitId: string, realm: string) =>
  queryOptions({
    queryKey: scoreKeys.aggregate(unitId, realm),
    queryFn: () => scoreApi.getAggregate(unitId, realm),
    staleTime: 1000 * 60 * 2,
  });

export const userScoresQuery = (userId: string, unitId: string) =>
  queryOptions({
    queryKey: scoreKeys.userScoresForUnit(userId, unitId),
    queryFn: () => scoreApi.getUserScores(userId, unitId),
    staleTime: 1000 * 60 * 2,
  });

export const realmFieldsQuery = (realmId: string) =>
  queryOptions({
    queryKey: scoreKeys.realmFieldsForRealm(realmId),
    queryFn: () => scoreApi.getRealmFields(realmId),
    staleTime: 1000 * 60 * 10,
  });

export const scoreQueries = {
  aggregates: scoreAggregatesQuery,
  aggregate: scoreAggregateQuery,
  userScores: userScoresQuery,
  realmFields: realmFieldsQuery,
};
