"use client";

import { Progress } from "@rezics/ui";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { useTranslation } from "@/i18n/client";
import {
	NavigationProgressContext,
	type StartNavigationProgress,
} from "./navigation-progress-context";

type NavigationProgressPhase = "hidden" | "pending" | "completing";

const CompletionDurationMs = 225;
const ShowDelayMs = 100;

export function NavigationProgressProvider({ children }: { readonly children: ReactNode }) {
	const [activeCount, setActiveCount] = useState(0);
	const start = useCallback<StartNavigationProgress>(() => {
		let stopped = false;
		setActiveCount((count) => count + 1);

		return () => {
			if (stopped) return;
			stopped = true;
			setActiveCount((count) => Math.max(0, count - 1));
		};
	}, []);

	return (
		<NavigationProgressContext.Provider value={start}>
			{children}
			<NavigationProgressIndicator pending={activeCount > 0} />
		</NavigationProgressContext.Provider>
	);
}

function NavigationProgressIndicator({ pending }: { readonly pending: boolean }) {
	const { t } = useTranslation(["state"]);
	const [phase, setPhase] = useState<NavigationProgressPhase>("hidden");

	useEffect(() => {
		if (pending) {
			if (phase === "completing") {
				setPhase("pending");
				return undefined;
			}
			if (phase === "hidden") {
				const timeout = setTimeout(() => setPhase("pending"), ShowDelayMs);
				return () => clearTimeout(timeout);
			}
			return undefined;
		}

		if (phase === "pending") {
			setPhase("completing");
			return undefined;
		}
		if (phase === "completing") {
			const timeout = setTimeout(() => setPhase("hidden"), CompletionDurationMs);
			return () => clearTimeout(timeout);
		}
		return undefined;
	}, [pending, phase]);

	if (phase === "hidden") return null;

	const completing = phase === "completing";

	return (
		<>
			<Progress
				aria-hidden="true"
				className={[
					"pointer-events-none fixed inset-x-0 top-0 z-[70] block w-full gap-0",
					"transition-opacity duration-150 ease-out motion-reduce:transition-none!",
					"[&_[data-slot=progress-range]]:duration-150!",
					"[&_[data-slot=progress-track]]:h-0.5!",
					"[&_[data-slot=progress-track]]:rounded-none!",
					"[&_[data-slot=progress-track]]:bg-transparent!",
					completing ? "opacity-0 delay-75" : "opacity-100",
				].join(" ")}
				indeterminate={!completing}
				value={completing ? 100 : undefined}
			/>
			{phase === "pending" ? (
				<span className="sr-only" role="status">
					{t.state.loading}
				</span>
			) : null}
		</>
	);
}
