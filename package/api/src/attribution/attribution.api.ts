import type {
  CreateOrganizationInput,
  CreatePersonInput,
  LinkOrgCreditInput,
  LinkPersonCreditInput,
  OrgCreditDTO,
  OrganizationDTO,
  OrganizationListQuery,
  PersonCreditDTO,
  PersonDTO,
  PersonListQuery,
  UpdateOrganizationInput,
  UpdatePersonInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

export const attributionApi = {
  // ---- Persons ----

  listPersons: async (
    query?: PersonListQuery,
  ): Promise<{ persons: PersonDTO[]; total: number }> => {
    return apiFetch<{ persons: PersonDTO[]; total: number }>(
      `/attribution/persons${buildQueryString(query)}`,
    );
  },

  getPerson: async (id: string): Promise<PersonDTO> => {
    return apiFetch<PersonDTO>(`/attribution/persons/${id}`);
  },

  createPerson: async (input: CreatePersonInput): Promise<PersonDTO> => {
    return apiFetch<PersonDTO>("/attribution/persons", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updatePerson: async (
    id: string,
    input: UpdatePersonInput,
  ): Promise<PersonDTO> => {
    return apiFetch<PersonDTO>(`/attribution/persons/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  deletePerson: async (id: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/attribution/persons/${id}`, {
      method: "DELETE",
    });
  },

  // ---- Organizations ----

  listOrganizations: async (
    query?: OrganizationListQuery,
  ): Promise<{ organizations: OrganizationDTO[]; total: number }> => {
    return apiFetch<{ organizations: OrganizationDTO[]; total: number }>(
      `/attribution/organizations${buildQueryString(query)}`,
    );
  },

  getOrganization: async (id: string): Promise<OrganizationDTO> => {
    return apiFetch<OrganizationDTO>(`/attribution/organizations/${id}`);
  },

  createOrganization: async (
    input: CreateOrganizationInput,
  ): Promise<OrganizationDTO> => {
    return apiFetch<OrganizationDTO>("/attribution/organizations", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateOrganization: async (
    id: string,
    input: UpdateOrganizationInput,
  ): Promise<OrganizationDTO> => {
    return apiFetch<OrganizationDTO>(`/attribution/organizations/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  deleteOrganization: async (id: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/attribution/organizations/${id}`, {
      method: "DELETE",
    });
  },

  // ---- Credits ----

  linkPersonCredit: async (
    input: LinkPersonCreditInput,
  ): Promise<PersonCreditDTO> => {
    return apiFetch<PersonCreditDTO>("/attribution/credits/person", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  unlinkPersonCredit: async (
    unitId: string,
    personId: string,
    roleKey: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/attribution/credits/person/${unitId}/${personId}/${roleKey}`,
      { method: "DELETE" },
    );
  },

  linkOrgCredit: async (
    input: LinkOrgCreditInput,
  ): Promise<OrgCreditDTO> => {
    return apiFetch<OrgCreditDTO>("/attribution/credits/organization", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  unlinkOrgCredit: async (
    unitId: string,
    organizationId: string,
    roleKey: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/attribution/credits/organization/${unitId}/${organizationId}/${roleKey}`,
      { method: "DELETE" },
    );
  },
};
