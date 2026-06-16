import { arrayMove } from "@dnd-kit/sortable";
import type {
  RealmTagDisplayTarget,
  RealmTagPreferences,
  UserSettings,
} from "@rezics/contract";
import { REALM_TAG_DISPLAY_TARGETS } from "./realmTagPreferenceTargets";

export type RealmTagPreferenceDraft = Required<RealmTagPreferences>;

const EMPTY_TARGET = { realmIds: [], maxDisplay: undefined };

export function createRealmTagPreferenceDraft(
  settings?: UserSettings | null,
): RealmTagPreferenceDraft {
  return Object.fromEntries(
    REALM_TAG_DISPLAY_TARGETS.map((target) => [
      target,
      {
        realmIds: [
          ...new Set(settings?.realmTagPreferences?.[target]?.realmIds ?? []),
        ],
        maxDisplay:
          settings?.realmTagPreferences?.[target]?.maxDisplay ?? undefined,
      },
    ]),
  ) as RealmTagPreferenceDraft;
}

export function pruneEmptyRealmTagPreferenceDraft(
  draft: RealmTagPreferenceDraft,
): RealmTagPreferences {
  const output: RealmTagPreferences = {};
  for (const target of REALM_TAG_DISPLAY_TARGETS) {
    const preference = draft[target] ?? EMPTY_TARGET;
    if (preference.realmIds.length === 0 && preference.maxDisplay == null) {
      continue;
    }
    output[target] = {
      realmIds: [...new Set(preference.realmIds)],
      maxDisplay: preference.maxDisplay ?? undefined,
    };
  }
  return output;
}

export function setRealmForTarget(
  draft: RealmTagPreferenceDraft,
  target: RealmTagDisplayTarget,
  realmId: string,
  enabled: boolean,
): RealmTagPreferenceDraft {
  const current = draft[target] ?? EMPTY_TARGET;
  const currentIds = current.realmIds.filter((id) => id !== realmId);
  return {
    ...draft,
    [target]: {
      ...current,
      // Detail-page toggles are intentionally append-only. Full ordering is
      // owned by the account preference editor where the whole list is visible.
      realmIds: enabled ? [...currentIds, realmId] : currentIds,
    },
  };
}

export function addRealmToTarget(
  draft: RealmTagPreferenceDraft,
  target: RealmTagDisplayTarget,
  realmId: string,
): RealmTagPreferenceDraft {
  return setRealmForTarget(draft, target, realmId, true);
}

export function removeRealmFromTarget(
  draft: RealmTagPreferenceDraft,
  target: RealmTagDisplayTarget,
  realmId: string,
): RealmTagPreferenceDraft {
  return setRealmForTarget(draft, target, realmId, false);
}

export function reorderRealmForTarget(
  draft: RealmTagPreferenceDraft,
  target: RealmTagDisplayTarget,
  activeId: string,
  overId: string,
): RealmTagPreferenceDraft {
  const current = draft[target] ?? EMPTY_TARGET;
  const oldIndex = current.realmIds.indexOf(activeId);
  const newIndex = current.realmIds.indexOf(overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return draft;
  return {
    ...draft,
    [target]: {
      ...current,
      realmIds: arrayMove(current.realmIds, oldIndex, newIndex),
    },
  };
}

export function setMaxDisplayForTarget(
  draft: RealmTagPreferenceDraft,
  target: RealmTagDisplayTarget,
  value: number | undefined,
): RealmTagPreferenceDraft {
  return {
    ...draft,
    [target]: {
      ...(draft[target] ?? EMPTY_TARGET),
      maxDisplay: value,
    },
  };
}
