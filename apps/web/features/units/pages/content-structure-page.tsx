"use client";

import {
	useReadCatalogResource,
	useListTextVersionContentNodes,
	useListProgramContentNodes,
	usePostApiUnitsByIdByUnitIdContentStructures,
} from "@rezics/openapi-tanstack-query";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";

import { RequestFailure } from "@/i18n/request-failure";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { BookContentStructureEditor } from "../components/book-content-structure-editor";
import { MediaContentStructureEditor } from "../components/media-content-structure-editor";
import { NativeContentStructureHeader } from "../components/native-content-structure-header";

export function ContentStructurePage({
	owner,
	unitId,
}: {
	owner: "publishing" | "program";
	unitId: string;
}) {
	const { t } = useTranslation(["errors"]);
	const resource = useReadCatalogResource({ path: { owner, id: unitId } });
	if (resource.isPending) return <QueryPending />;
	if (resource.isError)
		return <QueryFailure error={resource.error} retry={() => void resource.refetch()} />;
	if (!resource.data.canEdit || (owner === "publishing" && resource.data.shape !== "text_version"))
		return <p className="text-destructive">{t.errors.forbidden}</p>;
	return (
		<main className="mx-auto w-full max-w-6xl px-4 py-8">
			{owner === "publishing" ? (
				<BookContentStructurePage bookId={unitId} />
			) : (
				<MediaContentStructurePage mediaId={unitId} />
			)}
		</main>
	);
}

function MediaContentStructurePage({ mediaId }: { mediaId: string }) {
	const localizationLanguages = useLocalizationLanguages();
	const query = useListProgramContentNodes(
		{
			path: { unitId: mediaId },
			query: { localizationLanguages },
		},
		{
			query: {
				refetchOnReconnect: false,
				refetchOnWindowFocus: false,
			},
		},
	);
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<MediaContentStructureEditor
			initial={query.data}
			key={query.data.latestRevisionId ?? "uninitialized"}
			mediaId={mediaId}
		/>
	);
}

function BookContentStructurePage({ bookId }: { bookId: string }) {
	const { t } = useTranslation(["ui", "actions", "units"]);
	const initialize = usePostApiUnitsByIdByUnitIdContentStructures();
	const localizationLanguages = useLocalizationLanguages();
	const query = useListTextVersionContentNodes(
		{
			path: { unitId: bookId },
			query: { localizationLanguages },
		},
		{
			query: {
				refetchOnReconnect: false,
				refetchOnWindowFocus: false,
			},
		},
	);
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data.structureId || !query.data.latestRevisionId)
		return (
			<section className="grid gap-4">
				<NativeContentStructureHeader owner="publishing" unitId={bookId} />
				<Button
					disabled={initialize.isPending}
					onClick={() =>
						initialize.mutate(
							{ path: { unitId: bookId }, body: { kind: "book.contents" } },
							{
								onSuccess: () => {
									void query.refetch();
								},
							},
						)
					}
				>
					{t.actions.create}
				</Button>
				{initialize.error ? <RequestFailure error={initialize.error} /> : null}
			</section>
		);

	return (
		<BookContentStructureEditor
			bookId={bookId}
			initial={{
				...query.data,
				structureId: query.data.structureId,
				latestRevisionId: query.data.latestRevisionId,
			}}
			key={query.data.latestRevisionId}
		/>
	);
}
