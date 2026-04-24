/**
 * Pinboard API — unified exports.
 *
 * File organization:
 * - pinboard.api.ts: fetchers
 * - pinboard.keys.ts: React Query key factory
 * - pinboard.queries.ts: queryOptions
 * - pinboard.mutations.ts: mutation hooks
 */

export { pinboardApi } from "./pinboard.api";
export type {
  PinboardDetailQueryInput,
  PinboardListQueryInput,
} from "./pinboard.api";

export { pinboardKeys } from "./pinboard.keys";
export type {
  PinboardDetailKeyInput,
  PinboardListKeyInput,
} from "./pinboard.keys";

export {
  pinboardDetailQueryOptions,
  pinboardListQueryOptions,
  pinboardQueries,
} from "./pinboard.queries";

export {
  pinboardMutations,
  useCreatePinboardEntry,
  useDeletePinboardEntry,
  usePinToPinboard,
  useReorderPinboard,
  useUnpinFromPinboard,
  useUpdatePinboardEntry,
} from "./pinboard.mutations";

export type {
  CreatePinboardEntryBody,
  PinBody,
  PinboardDetailResponse,
  PinboardEntryDTO,
  PinboardEntryDetailDTO,
  PinboardEntryResponse,
  PinboardKey,
  PinboardListResponse,
  PinboardOkResponse,
  PinboardTranslationInput,
  ReorderBody,
  UpdatePinboardEntryBody,
} from "@rezics/contract";
