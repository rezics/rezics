"use client";

import {
	getApiUnitsByType,
	getApiUnitsByTypeQueryKey,
	usePostApiUnitsByType,
} from "@rezics/openapi-tanstack-query";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { PageHeading } from "@rezics/ui";
import { UnitList } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { Textarea } from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import type { UnitType } from "./unit-types";
import {
	LocalizationImageUploadField,
	type LocalizationImageAssetValue,
} from "./localization-image-upload-field";

export function UnitBrowsePage({ type }: { type: UnitType }) {
	const { t } = useTranslation({ suspense: true });
	const query = useInfiniteQuery({
		queryKey: getApiUnitsByTypeQueryKey({ path: { type } }),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiUnitsByType({
				path: { type },
				query: { limit: 20, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
	const items = query.data?.pages.flatMap((page) => page.items);
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				title={t.units.types[type]}
				action={
					<Button asChild>
						<Link href={`/units/${type}/new`}>{t.actions.create}</Link>
					</Button>
				}
			/>
			<UnitList
				error={query.isError}
				href={(item) => `/units/${type}/${item.id}`}
				items={items}
				pending={query.isPending}
			/>
			{query.isError && (
				<Button className="w-fit" onClick={() => void query.refetch()} variant="outline">
					{t.actions.retry}
				</Button>
			)}
			{query.hasNextPage && (
				<Button
					className="w-fit"
					isLoading={query.isFetchingNextPage}
					onClick={() => void query.fetchNextPage()}
					variant="outline"
				>
					{t.actions.loadMore}
				</Button>
			)}
		</main>
	);
}

export function UnitCreatePage({ type }: { type: UnitType }) {
	const { t, locale } = useTranslation({ suspense: true });
	const router = useRouter();
	const queryClient = useQueryClient();
	const [cover, setCover] = useState<LocalizationImageAssetValue | null>(null);
	const create = usePostApiUnitsByType({
		mutation: {
			onSuccess: async (unit) => {
				await queryClient.invalidateQueries({
					queryKey: getApiUnitsByTypeQueryKey({ path: { type } }),
				});
				router.push(`/units/${type}/${unit.id}`);
			},
		},
	});
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const slug = String(form.get("slug") ?? "").trim();
		const summary = String(form.get("summary") ?? "").trim();
		try {
			await create.mutateAsync({
				path: { type },
				body: {
					localization: {
						language: locale.target,
						title: String(form.get("title") ?? "").trim(),
						...(summary ? { summary } : {}),
						coverAssetId: cover?.id ?? null,
					},
					...(slug ? { slug } : {}),
					visibility:
						form.get("visibility") === "private"
							? "private"
							: form.get("visibility") === "unlisted"
								? "unlisted"
								: "public",
					contentRating:
						form.get("contentRating") === "r15"
							? "r15"
							: form.get("contentRating") === "r18"
								? "r18"
								: form.get("contentRating") === "r18g"
									? "r18g"
									: "general",
					aiDisclosure:
						form.get("aiDisclosure") === "none"
							? "none"
							: form.get("aiDisclosure") === "ai_assisted"
								? "ai_assisted"
								: form.get("aiDisclosure") === "ai_originated"
									? "ai_originated"
									: form.get("aiDisclosure") === "machine_generated"
										? "machine_generated"
										: "unknown",
					license: String(form.get("license") ?? "").trim() || null,
				},
			});
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading title={`${t.actions.create} ${t.units.types[type]}`} />
				<form onSubmit={submit}>
					<FieldGroup>
						<Field required>
							<FieldLabel>{t.ui.title}</FieldLabel>
							<Input maxLength={500} name="title" required />
						</Field>
						<Field>
							<FieldLabel>{t.ui.slug}</FieldLabel>
							<Input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
						</Field>
						<Field>
							<FieldLabel>{t.ui.summary}</FieldLabel>
							<Textarea maxLength={2000} name="summary" />
						</Field>
						<Field>
							<FieldLabel>{t.media.roles.cover.title}</FieldLabel>
							<LocalizationImageUploadField
								value={cover}
								onChange={setCover}
								role="cover"
								shape={type === "book" ? "portrait" : "landscape"}
							/>
						</Field>
						<Field>
							<FieldLabel>{t.ui.visibility}</FieldLabel>
							<NativeSelect defaultValue="public" name="visibility">
								<NativeSelectOption value="public">
									{t.ui.public}
								</NativeSelectOption>
								<NativeSelectOption value="unlisted">
									{t.ui.unlisted}
								</NativeSelectOption>
								<NativeSelectOption value="private">
									{t.ui.private}
								</NativeSelectOption>
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel>{t.ui.contentRating}</FieldLabel>
							<NativeSelect defaultValue="general" name="contentRating">
								<NativeSelectOption value="general">
									{t.units.rating.general}
								</NativeSelectOption>
								<NativeSelectOption value="r15">
									{t.units.rating.r15}
								</NativeSelectOption>
								<NativeSelectOption value="r18">
									{t.units.rating.r18}
								</NativeSelectOption>
								<NativeSelectOption value="r18g">
									{t.units.rating.r18g}
								</NativeSelectOption>
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel>{t.units.detail.aiDisclosure}</FieldLabel>
							<NativeSelect defaultValue="unknown" name="aiDisclosure">
								<NativeSelectOption value="unknown">
									{t.units.aiDisclosure.unknown}
								</NativeSelectOption>
								<NativeSelectOption value="none">
									{t.units.aiDisclosure.none}
								</NativeSelectOption>
								<NativeSelectOption value="ai_assisted">
									{t.units.aiDisclosure.ai_assisted}
								</NativeSelectOption>
								<NativeSelectOption value="ai_originated">
									{t.units.aiDisclosure.ai_originated}
								</NativeSelectOption>
								<NativeSelectOption value="machine_generated">
									{t.units.aiDisclosure.machine_generated}
								</NativeSelectOption>
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel>{t.units.detail.license}</FieldLabel>
							<Input name="license" />
						</Field>
						<RequestFailure error={create.error} fallback={t.ui.retryLater} />
						<Button isLoading={create.isPending} type="submit">
							{t.actions.create}
						</Button>
					</FieldGroup>
				</form>
			</main>
		</RequireSession>
	);
}
