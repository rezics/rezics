"use client";

import { Spinner } from "@rezics/ui";

import { useTranslation } from "@/i18n/client";

export function ApplicationRouteLoading() {
	const { t } = useTranslation(["state"]);

	return (
		<main aria-busy="true" className="grid min-h-64 place-items-center px-4 py-10">
			<div className="flex items-center gap-2 text-muted-foreground text-sm" role="status">
				<Spinner aria-hidden />
				{t.state.loading}
			</div>
		</main>
	);
}
