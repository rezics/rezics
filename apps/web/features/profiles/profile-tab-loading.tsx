"use client";

import { Skeleton, SkeletonText } from "@rezics/ui";

import { useTranslation } from "@/i18n/client";

export function ProfileTabLoading() {
	const { t } = useTranslation(["state"]);

	return (
		<section
			aria-busy="true"
			aria-label={t.state.loading}
			className="max-w-3xl rounded-2xl border border-border bg-surface p-6"
		>
			<Skeleton className="h-7 w-40" />
			<SkeletonText className="mt-6 max-w-2xl" lines={4} />
		</section>
	);
}
