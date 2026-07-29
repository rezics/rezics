"use client";

import { createContext, useContext, useEffect } from "react";

export type StopNavigationProgress = () => void;
export type StartNavigationProgress = () => StopNavigationProgress;

export const NavigationProgressContext = createContext<StartNavigationProgress | null>(null);

export function useNavigationProgressSignal(pending: boolean): void {
	const start = useContext(NavigationProgressContext);

	useEffect(() => {
		if (!pending || !start) return;
		return start();
	}, [pending, start]);
}
