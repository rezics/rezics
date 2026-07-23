"use client";

import {
	parseSearchDocument,
	parseSearchFeatureDefinition,
	type SearchDocument,
	type SearchFeatureDefinition,
	type SearchTemplateId,
} from "@rezics/search";
import {
	getApiSearchZonesByZoneIdFeatureQueryKey,
	getApiSearchZonesByZoneIdFeatureRevisionsQueryKey,
	useGetApiSearchFeaturesByTemplate,
	useGetApiSearchZonesByZoneIdFeature,
	useGetApiSearchZonesByZoneIdFeatureRevisions,
	usePostApiSearchZonesByZoneIdFeatureRestore,
	usePutApiSearchZonesByZoneIdFeature,
} from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Button,
	Card,
	CardContent,
	Checkbox,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	ManagementWorkspaceSectionHeader,
	NativeSelect,
	NativeSelectOption,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { zoneManagementHref } from "./model";
import { useZoneManagement } from "./workspace";

const Templates: readonly SearchTemplateId[] = ["global", "book", "media", "software"];

function hasStatus(error: unknown, status: number): boolean {
	return (
		typeof error === "object" && error !== null && "status" in error && error.status === status
	);
}

function reviseControl(
	document: SearchDocument,
	template: SearchDocument,
	controlKey: string,
	change: { readonly enabled?: boolean; readonly disclosure?: "visible" | "hidden" },
): SearchDocument {
	const current = document.controls.find((control) => control.key === controlKey);
	if (!current) return document;
	const enabled = change.enabled ?? current.enabled;
	const controls = document.controls.map((control) =>
		control.key === controlKey ? { ...control, ...change } : control,
	);
	let sections = document.sections.map((section) => ({
		...section,
		controls: [...section.controls],
	}));
	if (!enabled) {
		sections = sections.map((section) => ({
			...section,
			controls: section.controls.filter((key) => key !== controlKey),
		}));
	} else if (!sections.some((section) => section.controls.includes(controlKey))) {
		const templateSection = template.sections.find((section) =>
			section.controls.includes(controlKey),
		);
		if (templateSection) {
			const target = sections.find((section) => section.key === templateSection.key);
			if (target) target.controls.push(controlKey);
			else sections.push({ ...templateSection, controls: [controlKey] });
		}
	}
	const facets = enabled
		? template.results.facets.includes(controlKey) &&
			!document.results.facets.includes(controlKey)
			? [...document.results.facets, controlKey]
			: document.results.facets
		: document.results.facets.filter((key) => key !== controlKey);
	return parseSearchDocument({
		...document,
		controls,
		sections: sections.filter((section) => section.controls.length > 0),
		defaults: enabled
			? document.defaults
			: document.defaults.filter((value) => value.controlKey !== controlKey),
		results: { ...document.results, facets },
	});
}

function addTagControl(document: SearchDocument, template: SearchDocument): SearchDocument {
	const source = template.controls.find((control) => control.field === "tag");
	if (!source) return document;
	let suffix = 2;
	while (document.controls.some((control) => control.key === `tag-${suffix}`)) suffix += 1;
	const key = `tag-${suffix}`;
	const visibleSection = document.sections.find((section) => section.disclosure === "visible");
	return parseSearchDocument({
		...document,
		controls: [...document.controls, { ...source, key, disclosure: "visible" }],
		sections: visibleSection
			? document.sections.map((section) =>
					section.key === visibleSection.key
						? { ...section, controls: [...section.controls, key] }
						: section,
				)
			: [
					...document.sections,
					{ key: "filters", disclosure: "visible" as const, controls: [key] },
				],
		results: { ...document.results, facets: [...document.results.facets, key] },
	});
}

function removeControl(document: SearchDocument, controlKey: string): SearchDocument {
	return parseSearchDocument({
		...document,
		controls: document.controls.filter((control) => control.key !== controlKey),
		sections: document.sections
			.map((section) => ({
				...section,
				controls: section.controls.filter((key) => key !== controlKey),
			}))
			.filter((section) => section.controls.length > 0),
		defaults: document.defaults.filter((value) => value.controlKey !== controlKey),
		results: {
			...document.results,
			facets: document.results.facets.filter((key) => key !== controlKey),
		},
	});
}

export function ZoneSearchManagement() {
	const { zoneId } = useZoneManagement();
	const { t } = useTranslation(["errors", "search", "ui", "zones"]);
	const feature = useGetApiSearchZonesByZoneIdFeature({ path: { zoneId } });
	if (feature.isPending) return <QueryPending />;
	const notConfigured = feature.isError && hasStatus(feature.error, 404);
	if (feature.isError && !notConfigured)
		return <QueryFailure error={feature.error} retry={() => void feature.refetch()} />;
	const existing = feature.data
		? {
				...feature.data,
				definition: parseSearchFeatureDefinition(feature.data.definition),
			}
		: undefined;
	return (
		<section>
			<ManagementWorkspaceSectionHeader
				backHref={zoneManagementHref(zoneId)}
				backLabel={t.zones.management.title}
				description={t.zones.management.sections.search.description}
				link={Link}
				title={t.zones.management.sections.search.label}
			/>
			{notConfigured ? (
				<p className="mb-4 text-sm text-muted-foreground">
					{t.zones.management.search.notConfigured}
				</p>
			) : null}
			<SearchDocumentEditor existing={existing} zoneId={zoneId} />
		</section>
	);
}

function SearchDocumentEditor({
	existing,
	zoneId,
}: {
	readonly existing?: {
		readonly enabled: boolean;
		readonly latestRevisionId: string;
		readonly definition: SearchFeatureDefinition;
	};
	readonly zoneId: string;
}) {
	const { t, locale } = useTranslation(["errors", "search", "ui", "zones"]);
	const queryClient = useQueryClient();
	const [templateId, setTemplateId] = useState<SearchTemplateId>(
		existing?.definition.document.template.id ?? "global",
	);
	const [draft, setDraft] = useState<SearchDocument | undefined>(existing?.definition.document);
	const [enabled, setEnabled] = useState(existing?.enabled ?? true);
	const [message, setMessage] = useState("");
	const template = useGetApiSearchFeaturesByTemplate({ path: { template: templateId } });
	const history = useGetApiSearchZonesByZoneIdFeatureRevisions(
		{ path: { zoneId } },
		{ query: { enabled: Boolean(existing) } },
	);
	const invalidate = async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: getApiSearchZonesByZoneIdFeatureQueryKey({ path: { zoneId } }),
			}),
			queryClient.invalidateQueries({
				queryKey: getApiSearchZonesByZoneIdFeatureRevisionsQueryKey({ path: { zoneId } }),
			}),
		]);
	};
	const save = usePutApiSearchZonesByZoneIdFeature({ mutation: { onSuccess: invalidate } });
	const restore = usePostApiSearchZonesByZoneIdFeatureRestore({
		mutation: { onSuccess: invalidate },
	});
	if (template.isPending) return <QueryPending />;
	if (template.isError)
		return <QueryFailure error={template.error} retry={() => void template.refetch()} />;
	const templateDefinition = parseSearchFeatureDefinition(template.data);
	const document = draft?.template.id === templateId ? draft : templateDefinition.document;
	const resolvedControls =
		existing?.definition.document.template.id === templateId
			? existing.definition.controls
			: templateDefinition.controls;
	const controlMetadata = new Map(resolvedControls.map((control) => [control.key, control]));

	return (
		<div className="grid gap-6">
			<Card appearance="outlined">
				<CardContent className="grid gap-6 p-6">
					<FieldGroup className="grid gap-4 sm:grid-cols-2">
						<Field>
							<FieldLabel>{t.zones.management.search.template}</FieldLabel>
							<NativeSelect
								onChange={(event) => {
									const next = Templates.find(
										(candidate) => candidate === event.currentTarget.value,
									);
									if (next) {
										setTemplateId(next);
										setDraft(undefined);
									}
								}}
								value={templateId}
							>
								{Templates.map((candidate) => (
									<NativeSelectOption key={candidate} value={candidate}>
										{t.zones.management.search.templates[candidate]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						<label className="flex items-center gap-2 self-end pb-2 text-sm">
							<Checkbox
								checked={enabled}
								onCheckedChange={(details) => setEnabled(details.checked === true)}
							/>
							{t.zones.management.search.enabled}
						</label>
					</FieldGroup>
					<div>
						<div className="flex flex-wrap items-center justify-between gap-3">
							<h2 className="font-semibold text-lg">
								{t.zones.management.search.controls}
							</h2>
							<Button
								onClick={() =>
									setDraft(addTagControl(document, templateDefinition.document))
								}
								size="sm"
								type="button"
								variant="outline"
							>
								<Plus aria-hidden /> {t.zones.management.search.addTagControl}
							</Button>
						</div>
						<div className="mt-3 grid gap-3">
							{document.controls.map((control) => {
								const metadata = controlMetadata.get(control.key);
								const custom = !templateDefinition.document.controls.some(
									(candidate) => candidate.key === control.key,
								);
								return (
									<div
										className="grid gap-3 rounded-lg border border-border-weak p-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(10rem,auto)] sm:items-end"
										key={control.key}
									>
										<div className="min-w-0">
											<div className="flex flex-wrap items-center gap-2">
												<strong>{t.search.fields[control.field]}</strong>
												{metadata?.component ? (
													<Badge variant="secondary">
														{metadata.component}
													</Badge>
												) : null}
											</div>
											<code className="text-xs text-muted-foreground">
												{control.key}
											</code>
										</div>
										<label className="flex items-center gap-2 text-sm">
											<Checkbox
												checked={control.enabled}
												onCheckedChange={(details) =>
													setDraft(
														reviseControl(
															document,
															templateDefinition.document,
															control.key,
															{
																enabled: details.checked === true,
															},
														),
													)
												}
											/>
											{t.zones.management.search.controlEnabled}
										</label>
										<Field>
											<FieldLabel>
												{t.zones.management.search.disclosure}
											</FieldLabel>
											<NativeSelect
												disabled={!control.enabled}
												onChange={(event) =>
													setDraft(
														reviseControl(
															document,
															templateDefinition.document,
															control.key,
															{
																disclosure:
																	event.currentTarget.value ===
																	"hidden"
																		? "hidden"
																		: "visible",
															},
														),
													)
												}
												value={control.disclosure}
											>
												<NativeSelectOption value="visible">
													{t.zones.management.search.visible}
												</NativeSelectOption>
												<NativeSelectOption value="hidden">
													{t.zones.management.search.hidden}
												</NativeSelectOption>
											</NativeSelect>
										</Field>
										<Field className="sm:col-span-2">
											<FieldLabel>
												{t.zones.management.search.labelUnitId}
											</FieldLabel>
											<Input
												onChange={(event) => {
													const labelUnitId =
														event.currentTarget.value.trim();
													setDraft({
														...document,
														controls: document.controls.map(
															(candidate) =>
																candidate.key === control.key
																	? {
																			...candidate,
																			...(labelUnitId
																				? { labelUnitId }
																				: {
																						labelUnitId:
																							undefined,
																					}),
																		}
																	: candidate,
														),
													});
												}}
												value={control.labelUnitId ?? ""}
											/>
										</Field>
										{control.field === "tag" ? (
											<Field>
												<FieldLabel>
													{t.zones.management.search.allowedTagIds}
												</FieldLabel>
												<Input
													onChange={(event) => {
														const values = event.currentTarget.value
															.split(",")
															.map((value) => value.trim())
															.filter(Boolean);
														setDraft({
															...document,
															controls: document.controls.map(
																(candidate) =>
																	candidate.key === control.key
																		? {
																				...candidate,
																				optionPolicy:
																					values.length
																						? {
																								kind: "include",
																								values,
																							}
																						: {
																								kind: "all",
																							},
																			}
																		: candidate,
															),
														});
													}}
													placeholder={
														t.zones.management.search
															.allowedTagIdsPlaceholder
													}
													value={
														control.optionPolicy?.kind === "include"
															? control.optionPolicy.values.join(", ")
															: ""
													}
												/>
											</Field>
										) : null}
										{custom ? (
											<Button
												onClick={() =>
													setDraft(removeControl(document, control.key))
												}
												size="sm"
												type="button"
												variant="quiet"
											>
												<Trash2 aria-hidden />{" "}
												{t.zones.management.search.removeTagControl}
											</Button>
										) : null}
									</div>
								);
							})}
						</div>
					</div>
					<Field>
						<FieldLabel>{t.zones.management.search.message}</FieldLabel>
						<Input
							maxLength={500}
							onChange={(event) => setMessage(event.currentTarget.value)}
							placeholder={t.zones.management.search.messagePlaceholder}
							value={message}
						/>
					</Field>
					<Button
						isLoading={save.isPending}
						onClick={async () => {
							try {
								const saved = await save.mutateAsync({
									path: { zoneId },
									body: {
										enabled,
										document,
										...(existing
											? { baseRevisionId: existing.latestRevisionId }
											: {}),
										...(message.trim() ? { message: message.trim() } : {}),
									},
								});
								setDraft(parseSearchFeatureDefinition(saved.definition).document);
								setMessage("");
							} catch {
								// The typed mutation state supplies the visible request failure.
							}
						}}
						type="button"
					>
						{t.zones.management.search.save}
					</Button>
					<RequestFailure error={save.error} fallback={t.ui.retryLater} />
				</CardContent>
			</Card>
			{existing ? (
				<Card appearance="outlined">
					<CardContent className="p-6">
						<h2 className="font-semibold text-lg">
							{t.zones.management.search.history}
						</h2>
						{history.isPending ? <QueryPending /> : null}
						{history.isError ? (
							<QueryFailure
								error={history.error}
								retry={() => void history.refetch()}
							/>
						) : null}
						{history.data ? (
							<ul className="mt-4 grid gap-3">
								{history.data.items.map((revision) => (
									<li
										className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-weak p-3"
										key={revision.id}
									>
										<div>
											<strong>
												{
													t.zones.management.search.revisionKinds[
														revision.kind
													]
												}
											</strong>
											<p className="text-sm text-muted-foreground">
												{revision.editSummary ??
													new Intl.DateTimeFormat(locale.target, {
														dateStyle: "medium",
														timeStyle: "short",
													}).format(new Date(revision.createdAt))}
											</p>
										</div>
										<Button
											disabled={revision.id === existing.latestRevisionId}
											isLoading={restore.isPending}
											onClick={async () => {
												try {
													const restored = await restore.mutateAsync({
														path: { zoneId },
														body: {
															sourceRevisionId: revision.id,
															baseRevisionId:
																existing.latestRevisionId,
														},
													});
													setDraft(
														parseSearchFeatureDefinition(
															restored.definition,
														).document,
													);
												} catch {
													// The typed mutation state supplies the visible request failure.
												}
											}}
											size="sm"
											type="button"
											variant="outline"
										>
											{t.zones.management.search.restore}
										</Button>
									</li>
								))}
							</ul>
						) : null}
						<RequestFailure error={restore.error} fallback={t.ui.retryLater} />
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
