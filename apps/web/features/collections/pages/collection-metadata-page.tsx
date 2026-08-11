"use client";

import { usePatchApiCollectionsByCollectionId } from "@rezics/openapi-tanstack-query";
import { Button, ManagementWorkspaceSectionHeader } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import type { FormEvent } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useCollectionManagement } from "../components/collection-management-workspace";
import {
	CollectionLifecycleFields,
	CollectionStatuses,
	CollectionVisibilities,
	parseCollectionStatus,
	parseCollectionVisibility,
} from "../components/collection-localization-fields";
import { invalidateCollections } from "../data/collection-cache";
import { collectionManagementHref } from "../routing/collection-management-routes";

export function CollectionMetadataPage() {
	const { collection } = useCollectionManagement();
	const { t } = useTranslation(["collections", "errors", "ui"]);
	const queryClient = useQueryClient();
	const update = usePatchApiCollectionsByCollectionId();
	if (!collection.capabilities.canEditDetails)
		return <p className="text-sm text-destructive">{t.errors.forbidden}</p>;
	const status = CollectionStatuses.find((value) => value === collection.status) ?? "draft";
	const visibility =
		CollectionVisibilities.find((value) => value === collection.visibility) ?? "private";

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		try {
			await update.mutateAsync({
				path: { collectionId: collection.id },
				body: {
					baseRevisionId: collection.latestRevisionId,
					status: parseCollectionStatus(form.get("status")),
					visibility: parseCollectionVisibility(form.get("visibility")),
				},
			});
			await invalidateCollections(queryClient, collection.id);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<section className="grid gap-6">
			<ManagementWorkspaceSectionHeader
				backHref={collectionManagementHref(collection.id)}
				backLabel={t.collections.workspace.backToOverview}
				description={t.collections.workspace.sections.metadata.description}
				link={Link}
				title={t.collections.workspace.sections.metadata.label}
			/>
			{collection.capabilities.canEditDetails ? (
				<form className="grid max-w-xl gap-6" onSubmit={(event) => void submit(event)}>
					<CollectionLifecycleFields status={status} visibility={visibility} />
					<RequestFailure error={update.error} fallback={t.ui.retryLater} />
					<Button className="w-fit" isLoading={update.isPending} type="submit" variant="solid">
						{t.collections.form.save}
					</Button>
				</form>
			) : null}
		</section>
	);
}
