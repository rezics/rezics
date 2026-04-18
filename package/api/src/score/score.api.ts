import type {
  AddRealmFieldInput,
  ScoreAggregateDTO,
  ScoreEntryDTO,
  ScoreRealmFieldDTO,
  UpsertScoreInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const scoreApi = {
  upsertScore: async (input: UpsertScoreInput): Promise<ScoreEntryDTO> => {
    return apiFetch<ScoreEntryDTO>("/score", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  deleteScore: async (id: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/score/${id}`, {
      method: "DELETE",
    });
  },

  getAggregatesByUnit: async (unitId: string): Promise<ScoreAggregateDTO[]> => {
    return apiFetch<ScoreAggregateDTO[]>(`/score/unit/${unitId}`);
  },

  getAggregate: async (
    unitId: string,
    realm: string,
  ): Promise<ScoreAggregateDTO | null> => {
    return apiFetch<ScoreAggregateDTO | null>(`/score/unit/${unitId}/${realm}`);
  },

  getUserScores: async (
    userId: string,
    unitId: string,
  ): Promise<ScoreEntryDTO[]> => {
    return apiFetch<ScoreEntryDTO[]>(`/score/user/${userId}/${unitId}`);
  },

  getRealmFields: async (realmId: string): Promise<ScoreRealmFieldDTO[]> => {
    return apiFetch<ScoreRealmFieldDTO[]>(`/score/realm/${realmId}`);
  },

  addRealmField: async (
    realmId: string,
    input: AddRealmFieldInput,
  ): Promise<ScoreRealmFieldDTO> => {
    return apiFetch<ScoreRealmFieldDTO>(`/score/realm/${realmId}`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  removeRealmField: async (
    realmId: string,
    key: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/score/realm/${realmId}/${key}`, {
      method: "DELETE",
    });
  },
};
