"use client";

import { useSyncExternalStore } from "react";

const FineHoverQuery = "(hover: hover) and (pointer: fine)";
const listeners = new Set<() => void>();
let mediaQuery: MediaQueryList | undefined;

function getMediaQuery(): MediaQueryList | undefined {
	if (typeof window === "undefined") return undefined;
	mediaQuery ??= window.matchMedia(FineHoverQuery);
	return mediaQuery;
}

function notifyListeners() {
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
	const query = getMediaQuery();
	listeners.add(listener);
	if (listeners.size === 1) query?.addEventListener("change", notifyListeners);
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0) query?.removeEventListener("change", notifyListeners);
	};
}

function getSnapshot(): boolean {
	return getMediaQuery()?.matches ?? false;
}

export function useFineHover(): boolean {
	return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
