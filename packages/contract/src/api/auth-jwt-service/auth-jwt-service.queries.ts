import { queryOptions } from "@tanstack/react-query";
import { authJwtServiceApi } from "./auth-jwt-service.api";
import { authJwtServiceKeys } from "./auth-jwt-service.keys";

export const authJwtServiceListQuery = () =>
  queryOptions({
    queryKey: authJwtServiceKeys.list(),
    queryFn: () => authJwtServiceApi.list(),
    staleTime: 1000 * 60 * 2,
  });

export const authJwtServiceDetailQuery = (serviceKey: string) =>
  queryOptions({
    queryKey: authJwtServiceKeys.detail(serviceKey),
    queryFn: () => authJwtServiceApi.fetch(serviceKey),
    staleTime: 1000 * 60 * 2,
  });

export const authJwtServiceQueries = {
  list: authJwtServiceListQuery,
  detail: authJwtServiceDetailQuery,
};
