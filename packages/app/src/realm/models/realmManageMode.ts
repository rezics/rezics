import type { UserSettings } from "@rezics/contract";
import { useEffect, useState } from "react";

const sessionOverrides = new Map<string, boolean>();

export function getRealmManageModeAccountDefault(
  settings: UserSettings | null | undefined,
) {
  return settings?.moderation?.realmManageModeDefault !== false;
}

export function getRealmManageModeInitialValue(input: {
  realmId: string;
  settings?: UserSettings | null;
}) {
  return (
    sessionOverrides.get(input.realmId) ??
    getRealmManageModeAccountDefault(input.settings)
  );
}

export function clearRealmManageModeSessionOverrides() {
  sessionOverrides.clear();
}

export function setRealmManageModeSessionOverride(
  realmId: string,
  enabled: boolean,
) {
  sessionOverrides.set(realmId, enabled);
}

export function useRealmManageMode(input: {
  realmId: string;
  settings?: UserSettings | null;
}) {
  const [enabled, setEnabled] = useState(() =>
    getRealmManageModeInitialValue(input),
  );

  useEffect(() => {
    setEnabled(getRealmManageModeInitialValue(input));
  }, [input]);

  const setSessionEnabled = (next: boolean) => {
    setRealmManageModeSessionOverride(input.realmId, next);
    setEnabled(next);
  };

  return [enabled, setSessionEnabled] as const;
}
