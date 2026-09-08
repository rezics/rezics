"use client";
import {
	getApiUnitsByType,
	getApiUnitsByTypeQueryKey,
	usePostApiUnitsByType,
} from "@rezics/openapi-tanstack-query";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
	Button,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	PageHeading,
	Textarea,
	UnitList,
} from "@rezics/ui";
import { useState, type FormEvent } from "react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { RequireSession } from "@/features/auth/require-session";
import { studioSectionCreateHref } from "@/features/create/model/studio-section";
import { DraftContentLanguageField } from "@/features/content-languages/components/draft-content-language-field";
import { useFormDraftContentLanguage } from "@/features/content-languages/hooks/use-form-draft-content-language";
import {
	LocalizationImageUploadField,
	type LocalizationImageAssetValue,
} from "@/features/media/components/localization-image-upload-field";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { AdaptedAudioField } from "./components/adapted-audio-field";
import type { UnitType } from "./unit-types";

export function UnitBrowsePage({ type }: { readonly type: UnitType }) {
	const { t } = useTranslation(["actions", "units"]),
		localizationLanguages = useLocalizationLanguages();
	const baseQuery = { limit: 20, localizationLanguages };
	const query = useInfiniteQuery({
		queryKey: getApiUnitsByTypeQueryKey({ path: { type }, query: baseQuery }),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiUnitsByType({
				path: { type },
				query: { ...baseQuery, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
	return (
		<main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8">
			<PageHeading
				title={t.units.types[type]}
				action={
					<Button asChild>
						<Link href={studioSectionCreateHref(type)}>{t.actions.create}</Link>
					</Button>
				}
			/>
			<UnitList
				items={query.data?.pages.flatMap((page) => page.items)}
				pending={query.isPending}
				error={query.isError}
				href={(item) => `/units/${type}/${item.id}`}
				variant="shelf"
			/>
			{query.isError ? (
				<Button onClick={() => void query.refetch()}>{t.actions.retry}</Button>
			) : null}
			{query.hasNextPage ? (
				<Button
					variant="outline"
					isLoading={query.isFetchingNextPage}
					onClick={() => void query.fetchNextPage()}
				>
					{t.actions.loadMore}
				</Button>
			) : null}
		</main>
	);
}

export function UnitCreatePage({ type }: { readonly type: UnitType }) {
	const { t } = useTranslation(["actions", "create", "media", "units", "ui"]),
		router = useApplicationRouter(),
		cache = useQueryClient();
	const language = useFormDraftContentLanguage(["title", "summary"]);
	const [cover, setCover] = useState<LocalizationImageAssetValue | null>(null),
		[adaptedAudioUnitIds, setAdaptedAudioUnitIds] = useState<readonly string[]>([]),
		[invalidDuration, setInvalidDuration] = useState(false);
	const create = usePostApiUnitsByType({
		mutation: {
			onSuccess: async (created) => {
				await cache.invalidateQueries({ queryKey: getApiUnitsByTypeQueryKey({ path: { type } }) });
				router.push(`/units/${type}/${created.id}`);
			},
		},
	});
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (create.isPending) return;
		const formElement = event.currentTarget,
			form = new FormData(formElement),
			title = String(form.get("title") ?? "").trim(),
			summary = String(form.get("summary") ?? "").trim(),
			raw = String(form.get("duration") ?? "").trim();
		const duration = raw ? Number(raw) : null;
		if (
			raw &&
			(!/^\d+$/u.test(raw) ||
				!Number.isSafeInteger(duration) ||
				duration === null ||
				duration < 1 ||
				duration > 2147483647)
		) {
			setInvalidDuration(true);
			return;
		}
		setInvalidDuration(false);
		if (!title) return;
		const contentLanguage = await language.resolveLanguage(formElement);
		await create
			.mutateAsync({
				path: { type },
				body: {
					owner: type,
					localization: {
						language: contentLanguage,
						title,
						summary: summary || undefined,
						coverAssetId: cover?.id,
					},
					visibility: "private",
					contentRating: "general",
					aiDisclosure: "unknown",
					durationSeconds: duration,
					...(type === "video" ? { adaptedAudioUnitIds: [...adaptedAudioUnitIds] } : {}),
				},
			})
			.catch(() => undefined);
	}
	return (
		<RequireSession>
			<main className="mx-auto grid w-full max-w-2xl gap-6 px-4 py-8">
				<PageHeading title={t.create.overview.createAction({ subject: t.units.types[type] })} />
				<p className="text-sm text-muted-foreground">{t.create.native.privateDraft}</p>
				<form onInput={language.onInput} onSubmit={(event) => void submit(event)}>
					<FieldGroup>
						<Field required>
							<FieldLabel>{t.ui.title}</FieldLabel>
							<Input name="title" required maxLength={500} />
						</Field>
						<Field>
							<FieldLabel>{t.ui.summary}</FieldLabel>
							<Textarea name="summary" maxLength={4000} />
						</Field>
						<DraftContentLanguageField controller={language.controller} />
						<Field invalid={invalidDuration}>
							<FieldLabel>{t.units.fields.durationSeconds}</FieldLabel>
							<Input name="duration" type="number" min={1} max={2147483647} step={1} />
							{invalidDuration ? (
								<p className="text-sm text-destructive" role="alert">
									{t.create.native.errors.number}
								</p>
							) : null}
						</Field>
						{type === "video" ? (
							<AdaptedAudioField value={adaptedAudioUnitIds} onChange={setAdaptedAudioUnitIds} />
						) : null}
						<Field>
							<FieldLabel>{t.media.roles.cover.title}</FieldLabel>
							<LocalizationImageUploadField role="cover" value={cover} onChange={setCover} />
						</Field>
						<RequestFailure error={create.error} />
						<Button type="submit" isLoading={create.isPending} disabled={create.isPending}>
							{t.actions.create}
						</Button>
					</FieldGroup>
				</form>
			</main>
		</RequireSession>
	);
}
