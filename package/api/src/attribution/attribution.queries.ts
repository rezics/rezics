import type {
  OrganizationListQuery,
  PersonListQuery,
} from "@rezics/contract";
import { queryOptions } from "@tanstack/react-query";
import { attributionApi } from "./attribution.api";
import { attributionKeys } from "./attribution.keys";

export const personListQuery = (query?: PersonListQuery) =>
  queryOptions({
    queryKey: attributionKeys.personList(query),
    queryFn: () => attributionApi.listPersons(query),
    staleTime: 1000 * 60 * 5,
  });

export const personDetailQuery = (id: string) =>
  queryOptions({
    queryKey: attributionKeys.personDetail(id),
    queryFn: () => attributionApi.getPerson(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 10,
  });

export const organizationListQuery = (query?: OrganizationListQuery) =>
  queryOptions({
    queryKey: attributionKeys.organizationList(query),
    queryFn: () => attributionApi.listOrganizations(query),
    staleTime: 1000 * 60 * 5,
  });

export const organizationDetailQuery = (id: string) =>
  queryOptions({
    queryKey: attributionKeys.organizationDetail(id),
    queryFn: () => attributionApi.getOrganization(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 10,
  });

export const attributionQueries = {
  personList: personListQuery,
  personDetail: personDetailQuery,
  organizationList: organizationListQuery,
  organizationDetail: organizationDetailQuery,
};
