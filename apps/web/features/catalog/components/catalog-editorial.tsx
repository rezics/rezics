"use client";
import { useMemo, useState, useEffect } from "react";
import type { CatalogReference } from "@rezics/reference";
import { canonicalizeContentLanguageTag, type ContentLanguageTag } from "@rezics/content-language";
import {
	useListCatalogEditorialLanguages,
	useReadCatalogEditorial,
	useWriteCatalogEditorial,
	useWithdrawCatalogEditorial,
	useListCatalogEditorialHistory,
	useReadCatalogEditorialRevision,
	useRestoreCatalogEditorial,
	useReadCatalogResource,
} from "@rezics/openapi-tanstack-query";
import type { ReadCatalogEditorialStatus200 } from "@rezics/openapi-tanstack-query";
import {
	Banner,
	Button,
	Cover,
	Field,
	FieldLabel,
	IdentityAvatar,
	Input,
	PageHeading,
	QueryFailure,
	QueryPending,
	Textarea,
} from "@rezics/ui";
import { AppLink } from "@/features/application-shell/components/app-link";
import { RequireSession } from "@/features/auth/require-session";
import { LocalizedPortableTextContent } from "@/features/content-language-display/localized-portable-text-content";
import { useRequestedContentLanguage } from "@/features/content-languages/hooks/use-content-language-navigation";
import { useLocalizedDraft } from "@/features/content-languages/hooks/use-content-language-editor";
import { LocalizedDraftGate } from "@/features/content-languages/components/localized-draft-gate";
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { AvatarField, avatarPresentationToInput } from "@/features/media/components/avatar-field";
import { LocalizationImageUploadField } from "@/features/media/components/localization-image-upload-field";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { readPortableText, writePortableText } from "@/lib/block";
import { CatalogNameEditor } from "./catalog-name-editor";
import { CatalogEditorialDraftCodec } from "../model/editorial-draft";

export function CatalogEditorialSection({ reference }: { reference: CatalogReference }) {
	const { locale } = useTranslation(["ui"]),
		requested = useRequestedContentLanguage();
	const languages = useListCatalogEditorialLanguages({ path: reference });
	if (languages.isPending) return <QueryPending />;
	if (languages.isError)
		return <QueryFailure error={languages.error} retry={() => void languages.refetch()} />;
	const active = languages.data.items.filter((item) => item.state === "active"),
		preferred = requested ?? locale.target;
	const selected =
		active.find((item) => item.language === preferred) ??
		active.find((item) => item.language.split("-")[0] === preferred.split("-")[0]) ??
		active[0];
	return selected ? (
		<EditorialLanguageView reference={reference} language={selected.language} />
	) : null;
}
function EditorialLanguageView({
	reference,
	language,
}: {
	reference: CatalogReference;
	language: string;
}) {
	const query = useReadCatalogEditorial({ path: { ...reference, language } });
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return <EditorialPreview value={query.data} />;
}
function EditorialPreview({ value }: { value: ReadCatalogEditorialStatus200 }) {
	return value.content ? (
		<section className="grid gap-4" lang={value.language}>
			{value.banner ? <Banner src={value.banner.url} alt="" /> : null}
			{value.avatar ? (
				<IdentityAvatar avatar={value.avatar} imageAlt="" fallback="" size="lg" />
			) : null}
			{value.cover ? <Cover className="max-w-48" src={value.cover.url} alt="" /> : null}
			{value.content.summary ? <p>{value.content.summary}</p> : null}
			{value.content.description ? (
				<LocalizedPortableTextContent
					language={value.language}
					value={readPortableText(value.content.description)}
				/>
			) : null}
		</section>
	) : null;
}
export function CatalogEditorialEditPage({ reference }: { reference: CatalogReference }) {
	return (
		<RequireSession>
			<EditorialWorkspace key={`${reference.owner}:${reference.id}`} reference={reference} />
		</RequireSession>
	);
}
function EditorialWorkspace({ reference }: { reference: CatalogReference }) {
	const { t, locale } = useTranslation(["units", "errors"]),
		copy = t.units.nativeEditorial;
	const [dirty, setDirty] = useState(false);
	useEffect(() => {
		if (!dirty) return;
		const warn = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = "";
		};
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [dirty]);
	const [input, setInput] = useState<string>(locale.target),
		[language, setLanguage] = useState(() => canonicalizeContentLanguageTag(locale.target)),
		[invalid, setInvalid] = useState(false);
	const names = useMemo(
		() => new Intl.DisplayNames([locale.current], { type: "language" }),
		[locale.current],
	);
	const resource = useReadCatalogResource({ path: reference }),
		languages = useListCatalogEditorialLanguages({ path: reference });
	if (resource.isPending || languages.isPending) return <QueryPending />;
	if (resource.isError)
		return <QueryFailure error={resource.error} retry={() => void resource.refetch()} />;
	if (languages.isError)
		return <QueryFailure error={languages.error} retry={() => void languages.refetch()} />;
	if (!resource.data.canEdit) return <p>{t.errors.forbidden}</p>;
	return (
		<main className="mx-auto grid max-w-4xl gap-5 px-4 py-8">
			<PageHeading title={copy.edit} />
			<Button asChild variant="outline">
				<AppLink href={`/catalog/${reference.owner}/${reference.id}`}>
					{t.units.nativeSemantics.openRecord}
				</AppLink>
			</Button>
			<CatalogNameEditor
				reference={reference}
				revision={resource.data.revision}
				onChanged={() => {
					void resource.refetch();
				}}
			/>
			<div className="flex flex-wrap gap-2">
				{languages.data.items.map((item) => (
					<Button
						variant="outline"
						key={item.language}
						onClick={() => {
							setInput(item.language);
							setLanguage(canonicalizeContentLanguageTag(item.language));
						}}
					>
						{names.of(item.language) ?? item.language}
					</Button>
				))}
			</div>
			<Field>
				<FieldLabel>{copy.language}</FieldLabel>
				<Input value={input} onChange={(event) => setInput(event.target.value)} />
			</Field>
			<Button
				variant="outline"
				onClick={() => {
					try {
						setLanguage(canonicalizeContentLanguageTag(input));
						setInvalid(false);
					} catch {
						setInvalid(true);
					}
				}}
			>
				{copy.openLanguage}
			</Button>
			{invalid ? <p role="alert">{copy.invalidLanguage}</p> : null}
			<EditorialEditLanguage
				key={language}
				reference={reference}
				language={language}
				onDirtyChange={setDirty}
				onChanged={() => {
					void languages.refetch();
					void resource.refetch();
				}}
			/>
		</main>
	);
}
function EditorialEditLanguage({
	reference,
	language,
	onChanged,
	onDirtyChange,
}: {
	reference: CatalogReference;
	language: ContentLanguageTag;
	onChanged: () => void;
	onDirtyChange: (dirty: boolean) => void;
}) {
	const { t } = useTranslation(["units"]),
		[history, setHistory] = useState(false);
	const query = useReadCatalogEditorial({ path: { ...reference, language } });
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const changed = () => {
		void query.refetch();
		onChanged();
	};
	return (
		<>
			<EditorialForm
				reference={reference}
				language={language}
				current={query.data}
				onChanged={changed}
				onDirtyChange={onDirtyChange}
			/>
			<Button
				variant="outline"
				aria-expanded={history}
				onClick={() => setHistory((value) => !value)}
			>
				{t.units.nativeSemantics.history}
			</Button>
			{history ? (
				<EditorialHistory
					reference={reference}
					language={language}
					current={query.data}
					onChanged={changed}
				/>
			) : null}
		</>
	);
}
function EditorialForm({
	reference,
	language,
	current,
	onChanged,
	onDirtyChange,
}: {
	reference: CatalogReference;
	language: ContentLanguageTag;
	current: ReadCatalogEditorialStatus200;
	onChanged: () => void;
	onDirtyChange: (dirty: boolean) => void;
}) {
	const { t } = useTranslation(["ui", "units", "media", "cover"]);
	const draft = useLocalizedDraft({
		scope: "catalog-editorial",
		resource: { id: reference.id, language, onDirtyChange },
		baseVersion: `${current.revision}:${current.editorialRevision}`,
		codec: CatalogEditorialDraftCodec,
		createInitialValue: () => ({
			summary: current.content?.summary ?? "",
			description: readPortableText(current.content?.description),
			avatar: current.avatar,
			banner: current.banner,
			cover: current.cover,
			avatarEdited: false,
			bannerEdited: false,
			coverEdited: false,
		}),
	});
	const write = useWriteCatalogEditorial(),
		withdraw = useWithdrawCatalogEditorial(),
		busy = write.isPending || withdraw.isPending,
		value = draft.value;
	return (
		<LocalizedDraftGate
			hydrated={draft.hydrated}
			serverChanged={draft.serverChanged}
			onDiscard={draft.discard}
		>
			<form
				className="grid gap-4"
				onSubmit={(event) => {
					event.preventDefault();
					if (busy || draft.serverChanged) return;
					void write
						.mutateAsync({
							path: { ...reference, language },
							body: {
								expectedRevision: current.revision,
								expectedEditorialRevision: current.editorialRevision,
								content: {
									summary: value.summary.trim() || null,
									description: value.description.length
										? writePortableText(value.description, current.content?.description)
										: null,
									avatar: value.avatarEdited
										? avatarPresentationToInput(value.avatar)
										: (current.content?.avatar ?? null),
									bannerAssetId: value.bannerEdited
										? (value.banner?.id ?? null)
										: (current.content?.bannerAssetId ?? null),
									coverAssetId: value.coverEdited
										? (value.cover?.id ?? null)
										: (current.content?.coverAssetId ?? null),
								},
							},
						})
						.then(() => {
							draft.commit();
							onChanged();
						})
						.catch(() => undefined);
				}}
			>
				<fieldset disabled={busy} inert={busy} className="grid gap-4">
					<Field>
						<FieldLabel>{t.ui.summary}</FieldLabel>
						<Textarea
							maxLength={500}
							value={value.summary}
							onChange={(event) => {
								const summary = event.target.value;
								draft.setValue((current) => ({ ...current, summary }));
							}}
							disabled={busy}
						/>
					</Field>
					<PortableTextEditor
						label={t.ui.description}
						value={value.description}
						onChange={(description) => draft.setValue((current) => ({ ...current, description }))}
					/>
					<Field>
						<FieldLabel>{t.media.roles.avatar.title}</FieldLabel>
						<AvatarField
							value={value.avatar}
							onChange={(avatar) =>
								draft.setValue((current) => ({ ...current, avatar, avatarEdited: true }))
							}
						/>
					</Field>
					<Field>
						<FieldLabel>{t.cover.title}</FieldLabel>
						<LocalizationImageUploadField
							role="cover"
							value={value.cover}
							onChange={(cover) =>
								draft.setValue((current) => ({ ...current, cover, coverEdited: true }))
							}
						/>
					</Field>
					<Field>
						<FieldLabel>{t.media.roles.banner.title}</FieldLabel>
						<LocalizationImageUploadField
							role="banner"
							value={value.banner}
							onChange={(banner) =>
								draft.setValue((current) => ({ ...current, banner, bannerEdited: true }))
							}
						/>
					</Field>
					<div className="flex gap-3">
						<Button type="submit" disabled={busy || draft.serverChanged}>
							{t.ui.save}
						</Button>
						{current.content ? (
							<Button
								type="button"
								variant="outline"
								disabled={busy || draft.serverChanged}
								onClick={() => {
									void withdraw
										.mutateAsync({
											path: { ...reference, language },
											body: {
												expectedRevision: current.revision,
												expectedEditorialRevision: current.editorialRevision,
											},
										})
										.then(() => {
											draft.commit();
											onChanged();
										})
										.catch(() => undefined);
								}}
							>
								{t.units.nativeEditorial.withdraw}
							</Button>
						) : null}
					</div>
					<RequestFailure error={write.error ?? withdraw.error} />
				</fieldset>
			</form>
		</LocalizedDraftGate>
	);
}
function EditorialHistory({
	reference,
	language,
	current,
	onChanged,
}: {
	reference: CatalogReference;
	language: ContentLanguageTag;
	current: ReadCatalogEditorialStatus200;
	onChanged: () => void;
}) {
	const { t } = useTranslation(["units", "ui"]),
		[cursors, setCursors] = useState<string[]>([]),
		[selected, setSelected] = useState<number>();
	const query = useListCatalogEditorialHistory({
			path: { ...reference, language },
			query: { limit: 25, cursor: cursors.at(-1) },
		}),
		restore = useRestoreCatalogEditorial();
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<section className="grid gap-3">
			{query.data.items.map((item) => (
				<article key={item.editorialRevision} className="grid gap-2 rounded border p-3">
					<time dateTime={item.createdAt}>{item.createdAt}</time>
					<Button
						variant="quiet"
						aria-expanded={selected === item.editorialRevision}
						onClick={() =>
							setSelected((value) =>
								value === item.editorialRevision ? undefined : item.editorialRevision,
							)
						}
					>
						{t.units.nativeSemantics.inspectValue} · {item.editorialRevision}
					</Button>
					{selected === item.editorialRevision ? (
						<>
							<EditorialHistoricalValue
								reference={reference}
								language={language}
								revision={item.editorialRevision}
							/>
							<Button
								disabled={restore.isPending || item.editorialRevision === current.editorialRevision}
								onClick={() => {
									void restore
										.mutateAsync({
											path: { ...reference, language },
											body: {
												expectedRevision: current.revision,
												expectedEditorialRevision: current.editorialRevision,
												historicalRevision: item.editorialRevision,
											},
										})
										.then(() => {
											onChanged();
											void query.refetch();
										})
										.catch(() => undefined);
								}}
							>
								{t.units.nativeSemantics.restore}
							</Button>
						</>
					) : null}
				</article>
			))}
			<div className="flex gap-2">
				{cursors.length ? (
					<Button variant="outline" onClick={() => setCursors((value) => value.slice(0, -1))}>
						{t.ui.shelf.previous}
					</Button>
				) : null}
				{query.data.nextCursor ? (
					<Button
						variant="outline"
						onClick={() => {
							const next = query.data.nextCursor;
							if (next) setCursors((value) => [...value, next]);
						}}
					>
						{t.ui.shelf.next}
					</Button>
				) : null}
			</div>
			<RequestFailure error={restore.error} />
		</section>
	);
}
function EditorialHistoricalValue({
	reference,
	language,
	revision,
}: {
	reference: CatalogReference;
	language: ContentLanguageTag;
	revision: number;
}) {
	const query = useReadCatalogEditorialRevision({
		path: { ...reference, language, editorialRevision: revision },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return <EditorialPreview value={query.data} />;
}
