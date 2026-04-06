import { queryOptions } from "@tanstack/react-query";
import { jwtServiceApi } from "./jwt-service.api";
import { jwtServiceKeys } from "./jwt-service.keys";

export const jwtServiceListQuery = () =>
  queryOptions({
    queryKey: jwtServiceKeys.list(),
    queryFn: () => jwtServiceApi.list(),
    staleTime: 1000 * 60 * 2,
  });

export const jwtServiceDetailQuery = (serviceKey: string) =>
  queryOptions({
    queryKey: jwtServiceKeys.detail(serviceKey),
    queryFn: () => jwtServiceApi.fetch(serviceKey),
    staleTime: 1000 * 60 * 2,
  });

export const jwtServiceQueries = {
  list: jwtServiceListQuery,
  detail: jwtServiceDetailQuery,
};
