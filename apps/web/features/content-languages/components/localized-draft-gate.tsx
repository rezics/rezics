"use client";

import { Alert, AlertAction, AlertDescription, AlertTitle, Button, Skeleton } from "@rezics/ui";
import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "@/i18n/client";

export function LocalizedDraftGate({
	hydrated,
	serverChanged,
	onDiscard,
	children,
}: {
	readonly hydrated: boolean;
	readonly serverChanged: boolean;
	readonly onDiscard: () => void;
	readonly children: ReactNode;
}) {
	const { t } = useTranslation(["units"]);
	if (!hydrated) return <Skeleton className="h-64 rounded-xl" />;
	return (
		<>
			{serverChanged ? (
				<Alert variant="warning">
					<TriangleAlert aria-hidden />
					<AlertTitle>{t.units.contentLanguages.draftConflictTitle}</AlertTitle>
					<AlertDescription>{t.units.contentLanguages.draftConflictDescription}</AlertDescription>
					<AlertAction>
						<Button onClick={onDiscard} size="sm" type="button" variant="outline">
							{t.units.contentLanguages.discardDraft}
						</Button>
					</AlertAction>
				</Alert>
			) : null}
			{children}
		</>
	);
}
