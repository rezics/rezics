import type {
  CastUnitAliasVoteInput,
  CreateUnitAliasInput,
  PatchUnitAliasPinInput,
  UnitAliasDTO,
  UnitAliasListQuery,
  UpdateUnitAliasInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

export const unitAliasApi = {
  list: async (
    query?: UnitAliasListQuery,
  ): Promise<{ aliases: UnitAliasDTO[]; total: number }> => {
    return apiFetch<{ aliases: UnitAliasDTO[]; total: number }>(
      `/unit-alias-record${buildQueryString(query)}`,
    );
  },

  create: async (input: CreateUnitAliasInput): Promise<UnitAliasDTO> => {
    return apiFetch<UnitAliasDTO>("/unit-alias-record", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update: async (
    aliasId: string,
    input: UpdateUnitAliasInput,
  ): Promise<UnitAliasDTO> => {
    return apiFetch<UnitAliasDTO>(
      `/unit-alias-record/${encodeURIComponent(aliasId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  patchPin: async (
    aliasId: string,
    input: PatchUnitAliasPinInput,
  ): Promise<UnitAliasDTO> => {
    return apiFetch<UnitAliasDTO>(
      `/unit-alias-record/${encodeURIComponent(aliasId)}/pin`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  hide: async (aliasId: string): Promise<UnitAliasDTO> => {
    return apiFetch<UnitAliasDTO>(
      `/unit-alias-record/${encodeURIComponent(aliasId)}/hide`,
      { method: "PATCH" },
    );
  },

  remove: async (aliasId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/unit-alias-record/${encodeURIComponent(aliasId)}`,
      { method: "DELETE" },
    );
  },

  vote: async (input: CastUnitAliasVoteInput): Promise<UnitAliasDTO> => {
    return apiFetch<UnitAliasDTO>("/unit-alias-vote", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};
