import type {
  UnitLastPosition,
  UserUnitProgressStatus,
} from "@rezics/contract";
import { atom } from "jotai";
import type { ReasonPostVisibility } from "../hooks/useReasonPostMutations";

export type StatusModalKind =
  | "active"
  | "reason"
  | "completed"
  | "removeBacklog"
  | null;

export type StatusModalDraft = {
  progress?: number;
  lastPosition?: UnitLastPosition | null;
  body?: string;
  visibility?: ReasonPostVisibility;
};

export type StatusModalState = {
  kind: StatusModalKind;
  status: UserUnitProgressStatus | null;
  draft: StatusModalDraft;
};

const INITIAL_STATE: StatusModalState = {
  kind: null,
  status: null,
  draft: {},
};

export const statusModalAtom = atom<StatusModalState>(INITIAL_STATE);

export const openStatusModalAtom = atom(
  null,
  (
    _get,
    set,
    payload: {
      kind: Exclude<StatusModalKind, null>;
      status: UserUnitProgressStatus;
      draft?: StatusModalDraft;
    },
  ) => {
    set(statusModalAtom, {
      kind: payload.kind,
      status: payload.status,
      draft: payload.draft ?? {},
    });
  },
);

export const closeStatusModalAtom = atom(null, (_get, set) => {
  set(statusModalAtom, INITIAL_STATE);
});

export const updateStatusModalDraftAtom = atom(
  null,
  (get, set, patch: StatusModalDraft) => {
    const current = get(statusModalAtom);
    set(statusModalAtom, {
      ...current,
      draft: { ...current.draft, ...patch },
    });
  },
);
