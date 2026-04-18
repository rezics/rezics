import { useSyncExternalStore } from "react";

interface ExternalLinkState {
  pendingHref: string | null;
  pendingHost: string | null;
}

let state: ExternalLinkState = { pendingHref: null, pendingHost: null };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function openExternal(href: string) {
  try {
    const url = new URL(href);
    state = { pendingHref: href, pendingHost: url.hostname };
  } catch {
    state = { pendingHref: href, pendingHost: href };
  }
  emit();
}

export function closeExternal() {
  state = { pendingHref: null, pendingHost: null };
  emit();
}

export function useExternalLinkStore(): ExternalLinkState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}
