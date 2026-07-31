"use client";

import {
	isPublicationLicenseId,
	isUnitContentLicenseSlug,
	PublicationLicenseIds,
} from "@rezics/license";

import {
	getApiUnitsByType,
	getApiUnitsByTypeQueryKey,
	usePostApiSeries,
	usePostApiUnitsByType,
} from "@rezics/openapi-tanstack-query";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { CommunityUnitSearchPrompt } from "@/features/create/components/community-unit-search-prompt";
import { unitCommunityUnitSearchSubject } from "@/features/create/model/community-unit-search";
import { type FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";

import { EntityPicker, type EntityPickerValue, PageHeading } from "@rezics/ui";
import { UnitList } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { Textarea } from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
import { DraftContentLanguageField } from "@/features/content-languages/components/draft-content-language-field";
import { useFormDraftContentLanguage } from "@/features/content-languages/hooks/use-form-draft-content-language";
import { useTranslation } from "@/i18n/client";
import { hasErrorCode } from "@/i18n/errors";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";
import type { WorkUnitType, VariantUnitType } from "./unit-types";
import {
	LocalizationImageUploadField,
	type LocalizationImageAssetValue,
} from "@/features/media/components/localization-image-upload-field";
import {
	type CreditEntitySearchScope,
	UnitCreditAttributionEditor,
} from "./components/unit-credit-attribution-editor";
import {
	type CreditAttributionDraft,
	createCreditAttributionDraft,
	validateCreditAttributionDrafts,
} from "./model/credit-attribution-draft";
import { CreditAttributionRequestConfirmationDialog } from "./components/credit-attribution-request-confirmation-dialog";
import {
	PublicWorkContentLicenseField,
	UnitContentLicenseField,
} from "./components/unit-content-license-field";
import {
	isWorkOwnershipMode,
	type WorkOwnershipMode,
	WorkOwnershipField,
} from "./components/work-ownership-field";
import { WorkReleaseStatusField } from "./components/work-release-status-field";
import { isWorkReleaseStatus } from "./model/work-release-status";

export function UnitBrowsePage({ type }: { type: WorkUnitType }) {
	const { t } = useTranslation(["actions", "media", "ui", "units"]);
	const localizationLanguages = useLocalizationLanguages();
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
	const items = query.data?.pages.flatMap((page) => page.items);
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				title={t.units.types[type]}
				action={
					<Button variant="solid" asChild>
						<Link href={`/units/${type}/new`}>{t.actions.create}</Link>
					</Button>
				}
			/>
			<UnitList
				error={query.isError}
				href={(item) => `/units/${type}/${item.id}`}
				items={items}
				pending={query.isPending}
				variant="shelf"
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

export function UnitCreatePage({ type }: { type: WorkUnitType }) {
	return type === "series" ? <SeriesCreatePage /> : <VariantUnitCreatePage type={type} />;
}

function SeriesCreatePage() {
	const { t } = useTranslation(["actions", "media", "ui", "units"]);
	const router = useApplicationRouter();
	const queryClient = useQueryClient();
	const [cover, setCover] = useState<LocalizationImageAssetValue | null>(null);
	const language = useFormDraftContentLanguage(["title", "summary"]);
	const create = usePostApiSeries({
		mutation: {
			onSuccess: async (created) => {
				await queryClient.invalidateQueries({
					queryKey: getApiUnitsByTypeQueryKey({ path: { type: "series" } }),
				});
				router.push(`/units/series/${created.id}`);
			},
		},
	});
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formElement = event.currentTarget;
		const form = new FormData(formElement);
		const title = String(form.get("title") ?? "").trim();
		const kind = String(form.get("kind") ?? "").trim();
		const summary = String(form.get("summary") ?? "").trim();
		if (!title || !kind) return;
		const contentLanguage = await language.resolveLanguage(formElement);
		try {
			await create.mutateAsync({
				body: {
					kind,
					localization: {
						language: contentLanguage,
						title,
						...(summary ? { summary } : {}),
						coverAssetId: cover?.id ?? null,
					},
				},
			});
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading title={`${t.actions.create} ${t.units.types.series}`} />
				<form onInput={language.onInput} onSubmit={(event) => void submit(event)}>
					<FieldGroup>
						<Field required>
							<FieldLabel>{t.ui.title}</FieldLabel>
							<Input maxLength={500} name="title" required />
						</Field>
						<Field required>
							<FieldLabel>{t.units.series.kind}</FieldLabel>
							<Input maxLength={64} name="kind" required />
						</Field>
						<Field>
							<FieldLabel>{t.ui.summary}</FieldLabel>
							<Textarea maxLength={2000} name="summary" />
						</Field>
						<DraftContentLanguageField controller={language.controller} />
						<Field>
							<FieldLabel>{t.media.roles.cover.title}</FieldLabel>
							<LocalizationImageUploadField
								onChange={setCover}
								role="cover"
								value={cover}
							/>
						</Field>
						<RequestFailure error={create.error} fallback={t.ui.retryLater} />
						<Button variant="solid" isLoading={create.isPending} type="submit">
							{t.actions.create}
						</Button>
					</FieldGroup>
				</form>
			</main>
		</RequireSession>
	);
}

function VariantUnitCreatePage({ type }: { type: VariantUnitType }) {
	const { t } = useTranslation(["actions", "create", "licenses", "media", "ui", "units"]);
	const router = useApplicationRouter();
	const queryClient = useQueryClient();
	const searchParams = useSearchParams();
	const searchSubject = unitCommunityUnitSearchSubject(type);
	const requestedOwnershipMode = searchParams.get("ownershipMode");
	const initialOwnershipMode: WorkOwnershipMode = isWorkOwnershipMode(requestedOwnershipMode)
		? requestedOwnershipMode
		: "profile_owned";
	const [title, setTitle] = useState(() => searchParams.get("title") ?? "");
	const [searchConfirmed, setSearchConfirmed] = useState(false);
	const [cover, setCover] = useState<LocalizationImageAssetValue | null>(null);
	const [ownershipMode, setOwnershipMode] = useState<WorkOwnershipMode>(initialOwnershipMode);
	const [creditAttributions, setCreditAttributions] = useState<readonly CreditAttributionDraft[]>(
		() => [createCreditAttributionDraft(type)],
	);
	const [creditValidationRequested, setCreditValidationRequested] = useState(false);
	const [versionKind, setVersionKind] = useState<"main" | "variant">("main");
	const [mainVersion, setMainVersion] = useState<EntityPickerValue>();
	const creditEntitySearchScope: CreditEntitySearchScope =
		ownershipMode === "community_owned" ? "public" : "direct";
	const language = useFormDraftContentLanguage(["title", "summary"]);
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
	const [pendingCreditRequestSubmission, setPendingCreditRequestSubmission] = useState<
		Parameters<typeof create.mutateAsync>[0] | null
	>(null);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formElement = event.currentTarget;
		const form = new FormData(formElement);
		const submittedTitle = String(form.get("title") ?? "").trim();
		const summary = String(form.get("summary") ?? "").trim();
		const submittedLicense = form.get("license");
		const submittedContentLicense = form.get("contentLicense");
		const submittedReleaseStatus = form.get("releaseStatus");
		const creditValidation = validateCreditAttributionDrafts(type, creditAttributions);
		setCreditValidationRequested(true);
		if (!creditValidation.ok) return;
		if (ownershipMode === "community_owned" && !searchConfirmed) return;
		if (versionKind === "variant" && !mainVersion) return;
		if (
			submittedLicense !== null &&
			submittedLicense !== "" &&
			!isPublicationLicenseId(submittedLicense)
		)
			return;
		if (
			submittedContentLicense !== null &&
			submittedContentLicense !== "none" &&
			!isUnitContentLicenseSlug(submittedContentLicense)
		)
			return;
		const contentLanguage = await language.resolveLanguage(formElement);
		const details =
			type === "book"
				? isWorkReleaseStatus(submittedReleaseStatus)
					? { type: "book" as const, releaseStatus: submittedReleaseStatus }
					: undefined
				: type === "media"
					? isWorkReleaseStatus(submittedReleaseStatus)
						? { type: "media" as const, releaseStatus: submittedReleaseStatus }
						: undefined
					: { type: "software" as const };
		if (!details) return;
		let request: Parameters<typeof create.mutateAsync>[0] | undefined;
		try {
			const version =
				versionKind === "variant" && mainVersion
					? ({ kind: "variant", mainUnitId: mainVersion.id } as const)
					: ({ kind: "main" } as const);
			const common = {
				version,
				details,
				localization: {
					language: contentLanguage,
					title: submittedTitle,
					...(summary ? { summary } : {}),
					coverAssetId: cover?.id ?? null,
				},
				visibility:
					form.get("visibility") === "private"
						? ("private" as const)
						: form.get("visibility") === "unlisted"
							? ("unlisted" as const)
							: ("public" as const),
				contentRating:
					form.get("contentRating") === "r15"
						? ("r15" as const)
						: form.get("contentRating") === "r18"
							? ("r18" as const)
							: form.get("contentRating") === "r18g"
								? ("r18g" as const)
								: ("general" as const),
				aiDisclosure:
					form.get("aiDisclosure") === "none"
						? ("none" as const)
						: form.get("aiDisclosure") === "ai_assisted"
							? ("ai_assisted" as const)
							: form.get("aiDisclosure") === "ai_originated"
								? ("ai_originated" as const)
								: form.get("aiDisclosure") === "machine_generated"
									? ("machine_generated" as const)
									: ("unknown" as const),
				license: isPublicationLicenseId(submittedLicense) ? submittedLicense : null,
			};
			request = {
				path: { type },
				body:
					ownershipMode === "profile_owned"
						? {
								ownershipMode,
								creditAttributions: creditValidation.creditAttributions,
								creditAttributionRequestConsent: "direct_only",
								...(isUnitContentLicenseSlug(submittedContentLicense)
									? {
											contentLicense: {
												referenceLicenseSlug: submittedContentLicense,
											},
										}
									: {}),
								...common,
							}
						: {
								ownershipMode,
								creditAttributions: creditValidation.creditAttributions,
								creditAttributionRequestConsent: "direct_only",
								...common,
							},
			};
			await create.mutateAsync(request);
		} catch (error) {
			if (request && hasErrorCode(error, "CreditAttributionRequestConfirmationRequired"))
				setPendingCreditRequestSubmission(request);
		}
	}
	async function confirmCreditRequests() {
		const request = pendingCreditRequestSubmission;
		if (!request) return;
		try {
			await create.mutateAsync({
				...request,
				body: {
					...request.body,
					creditAttributionRequestConsent: "allow_requests",
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
				<form onInput={language.onInput} onSubmit={(event) => void submit(event)}>
					<FieldGroup>
						<Field required>
							<FieldLabel>{t.ui.title}</FieldLabel>
							<Input
								maxLength={500}
								name="title"
								onChange={(event) => {
									setTitle(event.currentTarget.value);
									setSearchConfirmed(false);
								}}
								required
								value={title}
							/>
						</Field>
						<WorkOwnershipField
							onChange={(nextOwnershipMode) => {
								setOwnershipMode(nextOwnershipMode);
								setCreditValidationRequested(false);
							}}
							value={ownershipMode}
						/>
						{ownershipMode === "community_owned" ? (
							<CommunityUnitSearchPrompt
								confirmed={searchConfirmed}
								onConfirmedChange={setSearchConfirmed}
								query={title}
								subject={searchSubject}
							/>
						) : null}
						<UnitCreditAttributionEditor
							onChange={(value) => {
								setCreditAttributions(value);
								setCreditValidationRequested(false);
							}}
							searchScope={creditEntitySearchScope}
							type={type}
							validation={
								creditValidationRequested
									? validateCreditAttributionDrafts(type, creditAttributions)
									: undefined
							}
							value={creditAttributions}
						/>
						<Field required>
							<FieldLabel>{t.units.creation.versionRole}</FieldLabel>
							<NativeSelect
								name="versionKind"
								onChange={(event) =>
									setVersionKind(
										event.currentTarget.value === "variant"
											? "variant"
											: "main",
									)
								}
								value={versionKind}
							>
								<NativeSelectOption value="main">
									{t.units.creation.mainVersion}
								</NativeSelectOption>
								<NativeSelectOption value="variant">
									{t.units.creation.variantVersion}
								</NativeSelectOption>
							</NativeSelect>
						</Field>
						{versionKind === "variant" ? (
							<Field required>
								<FieldLabel>{t.units.creation.mainVersionEntity}</FieldLabel>
								<EntityPicker
									ariaLabel={t.units.creation.mainVersionEntity}
									index="units"
									kind={type}
									onChange={setMainVersion}
									onClear={() => setMainVersion(undefined)}
									placeholder={t.ui.pickerPlaceholders.unit}
									value={mainVersion}
								/>
								{mainVersion ? (
									<Button
										onClick={() => setMainVersion(undefined)}
										size="xs"
										type="button"
										variant="quiet"
									>
										{t.ui.clear}
									</Button>
								) : null}
							</Field>
						) : null}
						<Field>
							<FieldLabel>{t.ui.summary}</FieldLabel>
							<Textarea maxLength={2000} name="summary" />
						</Field>
						<DraftContentLanguageField controller={language.controller} />
						<Field>
							<FieldLabel>{t.media.roles.cover.title}</FieldLabel>
							<LocalizationImageUploadField
								value={cover}
								onChange={setCover}
								role="cover"
							/>
						</Field>
						{type === "book" || type === "media" ? <WorkReleaseStatusField /> : null}
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
							<NativeSelect defaultValue="" name="license">
								<NativeSelectOption value="">
									{t.licenses.unspecified}
								</NativeSelectOption>
								{PublicationLicenseIds.map((id) => (
									<NativeSelectOption key={id} value={id}>
										{t.licenses.options[id].label}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						{ownershipMode === "profile_owned" ? (
							<UnitContentLicenseField context="create" />
						) : (
							<PublicWorkContentLicenseField />
						)}
						<RequestFailure
							error={
								hasErrorCode(
									create.error,
									"CreditAttributionRequestConfirmationRequired",
								)
									? undefined
									: create.error
							}
							fallback={t.ui.retryLater}
						/>
						<Button
							disabled={
								(ownershipMode === "community_owned" && !searchConfirmed) ||
								(versionKind === "variant" && !mainVersion)
							}
							variant="solid"
							isLoading={create.isPending}
							type="submit"
						>
							{t.actions.create}
						</Button>
					</FieldGroup>
				</form>
				<CreditAttributionRequestConfirmationDialog
					onCancel={() => setPendingCreditRequestSubmission(null)}
					onConfirm={() => void confirmCreditRequests()}
					open={pendingCreditRequestSubmission !== null}
					pending={create.isPending}
				/>
			</main>
		</RequireSession>
	);
}
