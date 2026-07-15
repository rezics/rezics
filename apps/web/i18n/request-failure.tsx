"use client";

import { useTranslation } from "@/i18n/client";
import { getErrorText } from "@/i18n/errors";

export function RequestFailure({ error, fallback }: { error: unknown; fallback?: string }) {
	const { t } = useTranslation({ suspense: true });
	if (!error) return null;
	return (
		<p className="text-destructive text-sm" role="alert">
			{getErrorText(t, error, fallback ?? t.state.error)}
		</p>
	);
}
