"use client";
import { PageHeading } from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";
import { SourceJob } from "../components/source-job";
export function SourceJobPage(props: { sourceRecordId: string; jobId: string }) {
	const { t } = useTranslation(["units"]);
	return (
		<RequireSession>
			<main className="mx-auto grid max-w-3xl gap-6 px-4 py-8">
				<PageHeading title={t.units.nativeSources.job} />
				<SourceJob {...props} />
			</main>
		</RequireSession>
	);
}
