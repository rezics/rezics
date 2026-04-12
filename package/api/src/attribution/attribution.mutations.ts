import type {
  CreateOrganizationInput,
  CreatePersonInput,
  LinkOrgCreditInput,
  LinkPersonCreditInput,
  OrgCreditDTO,
  OrganizationDTO,
  PersonCreditDTO,
  PersonDTO,
  UpdateOrganizationInput,
  UpdatePersonInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { attributionApi } from "./attribution.api";
import { attributionKeys } from "./attribution.keys";

// ---- Person mutations ----

export function useCreatePersonMutation(
  options?: Omit<
    UseMutationOptions<PersonDTO, Error, CreatePersonInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePersonInput) =>
      attributionApi.createPerson(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: attributionKeys.personLists(),
      });
      queryClient.setQueryData(attributionKeys.personDetail(data.id), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdatePersonMutation(
  options?: Omit<
    UseMutationOptions<
      PersonDTO,
      Error,
      { id: string; input: UpdatePersonInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) => attributionApi.updatePerson(id, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(
        attributionKeys.personDetail(variables.id),
        data,
      );
      queryClient.invalidateQueries({
        queryKey: attributionKeys.personLists(),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDeletePersonMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => attributionApi.deletePerson(id),
    ...options,
    onSuccess: (data, id, onMutateResult, context) => {
      queryClient.removeQueries({
        queryKey: attributionKeys.personDetail(id),
      });
      queryClient.invalidateQueries({
        queryKey: attributionKeys.personLists(),
      });
      options?.onSuccess?.(data, id, onMutateResult, context);
    },
  });
}

// ---- Organization mutations ----

export function useCreateOrganizationMutation(
  options?: Omit<
    UseMutationOptions<OrganizationDTO, Error, CreateOrganizationInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrganizationInput) =>
      attributionApi.createOrganization(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: attributionKeys.organizationLists(),
      });
      queryClient.setQueryData(
        attributionKeys.organizationDetail(data.id),
        data,
      );
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateOrganizationMutation(
  options?: Omit<
    UseMutationOptions<
      OrganizationDTO,
      Error,
      { id: string; input: UpdateOrganizationInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) =>
      attributionApi.updateOrganization(id, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(
        attributionKeys.organizationDetail(variables.id),
        data,
      );
      queryClient.invalidateQueries({
        queryKey: attributionKeys.organizationLists(),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDeleteOrganizationMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => attributionApi.deleteOrganization(id),
    ...options,
    onSuccess: (data, id, onMutateResult, context) => {
      queryClient.removeQueries({
        queryKey: attributionKeys.organizationDetail(id),
      });
      queryClient.invalidateQueries({
        queryKey: attributionKeys.organizationLists(),
      });
      options?.onSuccess?.(data, id, onMutateResult, context);
    },
  });
}

// ---- Credit mutations ----

export function useLinkPersonCreditMutation(
  options?: Omit<
    UseMutationOptions<PersonCreditDTO, Error, LinkPersonCreditInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LinkPersonCreditInput) =>
      attributionApi.linkPersonCredit(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: attributionKeys.creditsByUnit(variables.unitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUnlinkPersonCreditMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { unitId: string; personId: string; roleKey: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, personId, roleKey }) =>
      attributionApi.unlinkPersonCredit(unitId, personId, roleKey),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: attributionKeys.creditsByUnit(variables.unitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useLinkOrgCreditMutation(
  options?: Omit<
    UseMutationOptions<OrgCreditDTO, Error, LinkOrgCreditInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LinkOrgCreditInput) =>
      attributionApi.linkOrgCredit(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: attributionKeys.creditsByUnit(variables.unitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUnlinkOrgCreditMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { unitId: string; organizationId: string; roleKey: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, organizationId, roleKey }) =>
      attributionApi.unlinkOrgCredit(unitId, organizationId, roleKey),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: attributionKeys.creditsByUnit(variables.unitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const attributionMutations = {
  useCreatePerson: useCreatePersonMutation,
  useUpdatePerson: useUpdatePersonMutation,
  useDeletePerson: useDeletePersonMutation,
  useCreateOrganization: useCreateOrganizationMutation,
  useUpdateOrganization: useUpdateOrganizationMutation,
  useDeleteOrganization: useDeleteOrganizationMutation,
  useLinkPersonCredit: useLinkPersonCreditMutation,
  useUnlinkPersonCredit: useUnlinkPersonCreditMutation,
  useLinkOrgCredit: useLinkOrgCreditMutation,
  useUnlinkOrgCredit: useUnlinkOrgCreditMutation,
};
