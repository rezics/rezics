/**
 * Pinboard API client functions.
 *
 * Backs ordered, realm-scoped lists of post ids (announcements, pinned
 * posts). Routes are nested under `/realms/:realmUnitId/pinboards/:pinboardKey`.
 */

import type {
  CreatePinboardEntryBody,
  PinBody,
  PinboardDetailResponse,
  PinboardEntryResponse,
  PinboardKey,
  PinboardListResponse,
  PinboardOkResponse,
  ReorderBody,
  UpdatePinboardEntryBody,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

export interface PinboardListQueryInput {
  realmUnitId: string;
  pinboardKey: PinboardKey;
  language?: string;
  adminView?: boolean;
}

export interface PinboardDetailQueryInput {
  realmUnitId: string;
  pinboardKey: PinboardKey;
  unitId: string;
  language?: string;
}

export const pinboardApi = {
  list: async (
    input: PinboardListQueryInput,
  ): Promise<PinboardListResponse> => {
    const qs = buildQueryString({
      language: input.language,
      adminView: input.adminView,
    });
    return apiFetch<PinboardListResponse>(
      `/realms/${input.realmUnitId}/pinboards/${input.pinboardKey}${qs}`,
    );
  },

  detail: async (
    input: PinboardDetailQueryInput,
  ): Promise<PinboardDetailResponse> => {
    const qs = buildQueryString({ language: input.language });
    return apiFetch<PinboardDetailResponse>(
      `/realms/${input.realmUnitId}/pinboards/${input.pinboardKey}/${input.unitId}${qs}`,
    );
  },

  create: async (
    realmUnitId: string,
    pinboardKey: PinboardKey,
    input: CreatePinboardEntryBody,
  ): Promise<PinboardEntryResponse> => {
    return apiFetch<PinboardEntryResponse>(
      `/realms/${realmUnitId}/pinboards/${pinboardKey}`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  update: async (
    realmUnitId: string,
    pinboardKey: PinboardKey,
    unitId: string,
    input: UpdatePinboardEntryBody,
  ): Promise<PinboardOkResponse> => {
    return apiFetch<PinboardOkResponse>(
      `/realms/${realmUnitId}/pinboards/${pinboardKey}/${unitId}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  remove: async (
    realmUnitId: string,
    pinboardKey: PinboardKey,
    unitId: string,
  ): Promise<PinboardOkResponse> => {
    return apiFetch<PinboardOkResponse>(
      `/realms/${realmUnitId}/pinboards/${pinboardKey}/${unitId}`,
      { method: "DELETE" },
    );
  },

  pin: async (
    realmUnitId: string,
    pinboardKey: PinboardKey,
    unitId: string,
    input: PinBody = {},
  ): Promise<PinboardOkResponse> => {
    return apiFetch<PinboardOkResponse>(
      `/realms/${realmUnitId}/pinboards/${pinboardKey}/${unitId}/pin`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  unpin: async (
    realmUnitId: string,
    pinboardKey: PinboardKey,
    unitId: string,
  ): Promise<PinboardOkResponse> => {
    return apiFetch<PinboardOkResponse>(
      `/realms/${realmUnitId}/pinboards/${pinboardKey}/${unitId}/unpin`,
      { method: "POST", body: JSON.stringify({}) },
    );
  },

  reorder: async (
    realmUnitId: string,
    pinboardKey: PinboardKey,
    input: ReorderBody,
  ): Promise<PinboardOkResponse> => {
    return apiFetch<PinboardOkResponse>(
      `/realms/${realmUnitId}/pinboards/${pinboardKey}/reorder`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },
};
