"use client";

import { Alert, AlertAction, AlertDescription, Button } from "@rezics/ui";
import { useEffect, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";

import { useTranslation } from "@/i18n/client";

type PwaStatus = "idle" | "offline-ready" | "update-available" | "updating";

export function PwaLifecycle() {
	const { t } = useTranslation(["actions", "state"]);
	const [status, setStatus] = useState<PwaStatus>("idle");
	const updateServiceWorker = useRef<ReturnType<typeof registerSW> | null>(null);

	useEffect(() => {
		updateServiceWorker.current = registerSW({
			immediate: true,
			onOfflineReady: () => setStatus("offline-ready"),
			onNeedRefresh: () => setStatus("update-available"),
			onRegisterError: (error: unknown) => {
				console.error("PWA service worker registration failed.", error);
			},
		});
	}, []);

	if (status === "idle") return null;

	const update = async () => {
		if (!updateServiceWorker.current) return;
		setStatus("updating");
		try {
			await updateServiceWorker.current(true);
		} catch (error) {
			console.error("PWA service worker update failed.", error);
			setStatus("update-available");
		}
	};

	return (
		<div className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-50 flex justify-center">
			<Alert
				className="bg-popover pointer-events-auto max-w-lg shadow-lg"
				role="status"
				variant="info"
			>
				<AlertDescription>
					{status === "offline-ready" ? t.state.offlineReady : t.state.updateAvailable}
				</AlertDescription>
				<AlertAction>
					{status !== "updating" && (
						<Button size="sm" variant="ghost" onClick={() => setStatus("idle")}>
							{status === "offline-ready" ? t.actions.dismiss : t.actions.later}
						</Button>
					)}
					{status !== "offline-ready" && (
						<Button
							isLoading={status === "updating"}
							size="sm"
							onClick={() => void update()}
						>
							{t.actions.update}
						</Button>
					)}
				</AlertAction>
			</Alert>
		</div>
	);
}
