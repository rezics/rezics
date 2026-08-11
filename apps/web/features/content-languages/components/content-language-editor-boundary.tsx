"use client";

import { useGetApiUnitsByIdByUnitIdLocalizationOrder } from "@rezics/openapi-tanstack-query";
import { QueryFailure, QueryPending } from "@rezics/ui";
import type { ReactNode } from "react";

import { ContentLanguageEditorProvider } from "../hooks/use-content-language-editor";

export function ContentLanguageEditorBoundary({
	unitId,
	onLanguagesChanged,
	children,
}: {
	readonly unitId: string;
	readonly onLanguagesChanged?: () => void | Promise<void>;
	readonly children: ReactNode;
}) {
	const query = useGetApiUnitsByIdByUnitIdLocalizationOrder({
		path: { unitId },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<ContentLanguageEditorProvider
			localizations={query.data.languages.map((language) => ({ language }))}
			onLanguagesChanged={async () => {
				await Promise.all([query.refetch(), onLanguagesChanged?.()]);
			}}
			unitId={unitId}
		>
			{children}
		</ContentLanguageEditorProvider>
	);
}
