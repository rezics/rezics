"use client";

import { toContentLanguage } from "@rezics/i18n";
import { usePostApiCollections } from "@rezics/openapi-tanstack-query";
import { Button, PageHeading } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { RequireSession } from "@/features/auth/require-session";
import type { LocalizationImageAssetValue } from "@/features/media/components/localization-image-upload-field";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { CollectionLocalizationFields } from "../components/collection-localization-fields";
import { invalidateCollections } from "../data/collection-cache";

export function CollectionCreatePage() {
	const create = usePostApiCollections();
	const queryClient = useQueryClient();
	const router = useRouter();
	const { locale, t } = useTranslation(["collections", "ui"]);
	const [cover, setCover] = useState<LocalizationImageAssetValue | null>(null);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const title = String(form.get("title") ?? "").trim();
		if (!title) return;
		try {
			const result = await create.mutateAsync({
				body: {
					localization: {
						language: toContentLanguage(locale.target),
						title,
						coverAssetId: cover?.id ?? null,
						...(String(form.get("summary") ?? "").trim()
							? { summary: String(form.get("summary") ?? "").trim() }
							: {}),
					},
					visibility: "private",
				},
			});
			await invalidateCollections(queryClient, result.id);
			router.push(`/collections/${result.id}/edit`);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
				<div className="grid gap-2">
					<PageHeading title={t.collections.newCollection} />
					<p className="text-muted-foreground">{t.collections.createDescription}</p>
				</div>
				<form className="grid gap-6" onSubmit={(event) => void submit(event)}>
					<CollectionLocalizationFields cover={cover} onCoverChange={setCover} />
					<RequestFailure error={create.error} fallback={t.ui.retryLater} />
					<Button isLoading={create.isPending} type="submit" variant="solid">
						{t.ui.create}
					</Button>
				</form>
			</main>
		</RequireSession>
	);
}
