import type {
  OrganizationListQuery,
  PersonListQuery,
} from "@rezics/contract";

export const attributionKeys = {
  all: () => ["attribution"] as const,

  // Persons
  personLists: () => [...attributionKeys.all(), "persons", "list"] as const,
  personList: (query?: PersonListQuery) =>
    [...attributionKeys.personLists(), query] as const,
  personDetails: () =>
    [...attributionKeys.all(), "persons", "detail"] as const,
  personDetail: (id: string) =>
    [...attributionKeys.personDetails(), id] as const,

  // Organizations
  organizationLists: () =>
    [...attributionKeys.all(), "organizations", "list"] as const,
  organizationList: (query?: OrganizationListQuery) =>
    [...attributionKeys.organizationLists(), query] as const,
  organizationDetails: () =>
    [...attributionKeys.all(), "organizations", "detail"] as const,
  organizationDetail: (id: string) =>
    [...attributionKeys.organizationDetails(), id] as const,

  // Credits
  creditsByUnit: (unitId: string) =>
    [...attributionKeys.all(), "credits", unitId] as const,
} as const;
