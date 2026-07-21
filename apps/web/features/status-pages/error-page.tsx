"use client";

import { Button } from "@rezics/ui";

import { useTranslation } from "@/i18n/client";

export function ErrorPage({ reset }: { reset: () => void }) {
	const { t } = useTranslation(["actions", "state", "ui"]);
	return (
		<main className="grid min-h-[60svh] place-items-center px-4 text-center">
			<div>
				<h1 className="text-2xl font-bold">{t.state.error}</h1>
				<p className="text-muted-foreground mt-3">{t.ui.retryLater}</p>
				<Button variant="solid" className="mt-6" onClick={reset}>
					{t.actions.retry}
				</Button>
			</div>
		</main>
	);
}
