"use client";

import { usePatchApiCollectionsByCollectionId } from "@rezics/openapi-tanstack-query";
import {
	Button,
	ChoiceSelect,
	Field,
	FieldGroup,
	FieldLabel,
	ManagementWorkspaceSectionHeader,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useCollectionManagement } from "../components/collection-management-workspace";
import { invalidateCollections } from "../data/collection-cache";
import { collectionManagementHref } from "../routing/collection-management-routes";

const CollectionLayouts = ["flat", "nested", "shelf"] as const;
const CollectionOrders = ["manual", "name", "added-at"] as const;

export function CollectionPresentationPage() {
	const { collection } = useCollectionManagement();
	const { t } = useTranslation(["collections", "errors", "ui"]);
	const queryClient = useQueryClient();
	const update = usePatchApiCollectionsByCollectionId();
	const [layout, setLayout] = useState(collection.presentationDocument.layout);
	const [order, setOrder] = useState(collection.presentationDocument.order);
	if (!collection.capabilities.canEditPresentation)
		return <p className="text-sm text-destructive">{t.errors.forbidden}</p>;

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		try {
			await update.mutateAsync({
				path: { collectionId: collection.id },
				body: {
					baseRevisionId: collection.latestRevisionId,
					presentationDocument: {
						...collection.presentationDocument,
						layout,
						order,
					},
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
				backLabel={t.collections.workspace.backToContent}
				description={t.collections.workspace.sections.presentation.description}
				link={Link}
				title={t.collections.workspace.sections.presentation.label}
			/>
			<form className="grid max-w-xl gap-6" onSubmit={(event) => void submit(event)}>
				<FieldGroup>
					<Field>
						<FieldLabel>{t.collections.presentation.layout}</FieldLabel>
						<ChoiceSelect
							appearance="field"
							ariaLabel={t.collections.presentation.layout}
							className="w-full"
							onValueChange={([value]) => {
								if (value) setLayout(value);
							}}
							options={CollectionLayouts.map((value) => ({
								value,
								label: t.collections.presentation.layouts[value],
							}))}
							placeholder={t.collections.presentation.layout}
							value={[layout]}
						/>
					</Field>
					<Field>
						<FieldLabel>{t.collections.presentation.order}</FieldLabel>
						<ChoiceSelect
							appearance="field"
							ariaLabel={t.collections.presentation.order}
							className="w-full"
							onValueChange={([value]) => {
								if (value) setOrder(value);
							}}
							options={CollectionOrders.map((value) => ({
								value,
								label: t.collections.presentation.orders[value],
							}))}
							placeholder={t.collections.presentation.order}
							value={[order]}
						/>
					</Field>
				</FieldGroup>
				<RequestFailure error={update.error} fallback={t.ui.retryLater} />
				<Button
					className="w-fit"
					isLoading={update.isPending}
					type="submit"
					variant="solid"
				>
					{t.collections.presentation.save}
				</Button>
			</form>
		</section>
	);
}
