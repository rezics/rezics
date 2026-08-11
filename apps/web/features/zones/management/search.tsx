"use client";

import {
	createFilterDocument,
	parseFilterDocument,
	parseSearchFeatureDefinition,
	SearchCategoryValues,
	type FilterDocument,
	type FilterDocumentControl,
	type ResolvedSearchControl,
} from "@rezics/filter";
import {
	getApiSearchZonesByZoneIdFilterQueryKey,
	getApiZonesByZoneIdQueryKey,
	postApiSearchFilterDefinition,
	useGetApiSearchZonesByZoneIdFilter,
	usePatchApiZonesByZoneId,
} from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Button,
	Card,
	CardContent,
	Checkbox,
	ChoiceSelect,
	Field,
	FieldLabel,
	ManagementWorkspaceSectionHeader,
	NativeSelect,
	NativeSelectOption,
	QueryFailure,
	QueryPending,
	UnitMultiPicker,
	UnitPicker,
} from "@rezics/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { zoneManagementHref } from "./model";
import { useZoneManagement } from "./workspace";

type ControlChange = Partial<
	Pick<
		FilterDocumentControl,
		"enabled" | "disclosure" | "labelUnitId" | "optionPolicy" | "required"
	>
>;

function withoutControlOverrides(document: FilterDocument): FilterDocument {
	const { controls: _controls, ...filterDocument } = document;
	return createFilterDocument(filterDocument);
}

function reviseControl(
	document: FilterDocument,
	control: ResolvedSearchControl,
	baseline: ResolvedSearchControl,
	change: ControlChange,
): FilterDocument {
	const controls = document.controls ?? [];
	const current = controls.find((candidate) => candidate.key === control.key);
	const candidate = { ...current, ...change };
	const custom = control.key !== control.field;
	const required = candidate.enabled === false ? undefined : candidate.required;
	const next: FilterDocumentControl = {
		key: control.key,
		...(custom ? { field: control.field } : {}),
		...(candidate.enabled === false ? { enabled: false } : {}),
		...(candidate.disclosure && candidate.disclosure !== baseline.disclosure
			? { disclosure: candidate.disclosure }
			: {}),
		...(candidate.labelUnitId ? { labelUnitId: candidate.labelUnitId } : {}),
		...(candidate.optionPolicy && candidate.optionPolicy.kind !== "all"
			? { optionPolicy: candidate.optionPolicy }
			: {}),
		...(required ? { required: true } : {}),
	};
	const meaningful = custom || Object.keys(next).length > 1;
	const revised = controls.flatMap((item) =>
		item.key === control.key ? (meaningful ? [next] : []) : [item],
	);
	if (!current && meaningful) revised.push(next);
	const { controls: _controls, ...base } = document;
	return createFilterDocument(revised.length ? { ...base, controls: revised } : base);
}

function addTagControl(document: FilterDocument, controls: readonly ResolvedSearchControl[]) {
	let suffix = 2;
	while (controls.some((control) => control.key === `tag-${suffix}`)) suffix += 1;
	return createFilterDocument({
		...document,
		controls: [...(document.controls ?? []), { key: `tag-${suffix}`, field: "tag" }],
	});
}

function removeCustomControl(document: FilterDocument, key: string) {
	const controls = (document.controls ?? []).filter((control) => control.key !== key);
	const { controls: _controls, ...base } = document;
	return createFilterDocument(controls.length ? { ...base, controls } : base);
}

export function ZoneSearchManagement() {
	const { zoneId } = useZoneManagement();
	const { t } = useTranslation(["search", "ui", "zones"]);
	const query = useGetApiSearchZonesByZoneIdFilter({ path: { zoneId } });
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const definition = parseSearchFeatureDefinition(query.data);
	return (
		<section>
			<ManagementWorkspaceSectionHeader
				backHref={zoneManagementHref(zoneId)}
				backLabel={t.zones.management.title}
				description={t.zones.management.sections.search.description}
				link={Link}
				title={t.zones.management.sections.search.label}
			/>
			<FilterDocumentEditor initialDocument={definition.filterDocument} zoneId={zoneId} />
		</section>
	);
}

function FilterDocumentEditor({
	initialDocument,
	zoneId,
}: {
	readonly initialDocument: FilterDocument;
	readonly zoneId: string;
}) {
	const { t } = useTranslation(["search", "ui", "zones"]);
	const queryClient = useQueryClient();
	const [draft, setDraft] = useState(() => parseFilterDocument(initialDocument));
	const baselineDocument = useMemo(() => withoutControlOverrides(draft), [draft]);
	const definitionQuery = useQuery({
		queryKey: ["filter-document-definition", draft],
		queryFn: async () => (await postApiSearchFilterDefinition({ body: draft })).data,
	});
	const baselineQuery = useQuery({
		queryKey: ["filter-document-baseline", baselineDocument],
		queryFn: async () => (await postApiSearchFilterDefinition({ body: baselineDocument })).data,
	});
	const invalidate = async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: getApiZonesByZoneIdQueryKey({ path: { zoneId } }),
			}),
			queryClient.invalidateQueries({
				queryKey: getApiSearchZonesByZoneIdFilterQueryKey({ path: { zoneId } }),
			}),
		]);
	};
	const save = usePatchApiZonesByZoneId({ mutation: { onSuccess: invalidate } });
	if (definitionQuery.isPending || baselineQuery.isPending) return <QueryPending />;
	if (definitionQuery.isError)
		return (
			<QueryFailure error={definitionQuery.error} retry={() => void definitionQuery.refetch()} />
		);
	if (baselineQuery.isError)
		return <QueryFailure error={baselineQuery.error} retry={() => void baselineQuery.refetch()} />;
	const definition = parseSearchFeatureDefinition(definitionQuery.data);
	const baseline = parseSearchFeatureDefinition(baselineQuery.data);
	const baselineByField = new Map(baseline.controls.map((control) => [control.field, control]));
	const updateControl = (control: ResolvedSearchControl, change: ControlChange) => {
		const defaultControl = baselineByField.get(control.field);
		if (!defaultControl) return;
		setDraft((current) => reviseControl(current, control, defaultControl, change));
	};

	return (
		<Card appearance="outlined">
			<CardContent className="grid gap-6 p-6">
				<Field>
					<FieldLabel>{t.zones.create.categories}</FieldLabel>
					<ChoiceSelect
						appearance="field"
						ariaLabel={t.zones.create.categories}
						className="h-10 w-full"
						multiple
						onValueChange={(categories) =>
							setDraft((current) => {
								const { categories: _categories, ...base } = current;
								return createFilterDocument(
									categories.length ? { ...base, categories: [...categories] } : base,
								);
							})
						}
						options={SearchCategoryValues.map((value) => ({
							value,
							label: t.search.categoryOptions[value],
						}))}
						placeholder={t.zones.create.categoriesPlaceholder}
						value={draft.categories ?? []}
					/>
				</Field>
				<div>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 className="font-semibold text-lg">{t.zones.management.search.controls}</h2>
						<Button
							onClick={() => setDraft(addTagControl(draft, definition.controls))}
							size="sm"
							type="button"
							variant="outline"
						>
							<Plus aria-hidden /> {t.zones.management.search.addTagControl}
						</Button>
					</div>
					<div className="mt-3 grid gap-3">
						{definition.controls.map((control) => {
							const custom = control.key !== control.field;
							return (
								<div
									className="grid gap-3 rounded-lg border border-border-weak p-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(10rem,auto)] sm:items-end"
									key={control.key}
								>
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-2">
											<strong>{t.search.fields[control.field]}</strong>
											<Badge variant="secondary">{control.component}</Badge>
										</div>
										<code className="text-xs text-muted-foreground">{control.key}</code>
									</div>
									<label className="flex items-center gap-2 text-sm">
										<Checkbox
											checked={control.enabled}
											onCheckedChange={(details) =>
												updateControl(control, { enabled: details.checked === true })
											}
										/>
										{t.zones.management.search.controlEnabled}
									</label>
									<Field>
										<FieldLabel>{t.zones.management.search.disclosure}</FieldLabel>
										<NativeSelect
											disabled={!control.enabled}
											onChange={(event) =>
												updateControl(control, {
													disclosure: event.currentTarget.value === "hidden" ? "hidden" : "visible",
												})
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
										<FieldLabel>{t.zones.management.search.labelUnitId}</FieldLabel>
										<UnitPicker
											ariaLabel={t.zones.management.search.labelUnitId}
											onValueChange={(labelUnitId) =>
												updateControl(control, { labelUnitId: labelUnitId || undefined })
											}
											placeholder={t.ui.pickerPlaceholders.unit}
											value={control.labelUnitId ?? ""}
										/>
									</Field>
									{control.field === "tag" ? (
										<Field>
											<FieldLabel>{t.zones.management.search.allowedTagIds}</FieldLabel>
											<UnitMultiPicker
												ariaLabel={t.zones.management.search.allowedTagIds}
												index="tags"
												kinds={["tag"]}
												onValuesChange={(values) =>
													updateControl(control, {
														optionPolicy: values.length
															? { kind: "include", values: [...values] }
															: undefined,
													})
												}
												removeLabel={t.zones.management.search.removeAllowedTag}
												placeholder={t.ui.pickerPlaceholders.tag}
												values={
													control.optionPolicy?.kind === "include"
														? control.optionPolicy.values.flatMap((value) =>
																typeof value === "string" ? [value] : [],
															)
														: []
												}
											/>
										</Field>
									) : null}
									{custom ? (
										<Button
											onClick={() => setDraft(removeCustomControl(draft, control.key))}
											size="sm"
											type="button"
											variant="quiet"
										>
											<Trash2 aria-hidden /> {t.zones.management.search.removeTagControl}
										</Button>
									) : null}
								</div>
							);
						})}
					</div>
				</div>
				<Button
					isLoading={save.isPending}
					onClick={async () => {
						try {
							const saved = await save.mutateAsync({
								path: { zoneId },
								body: { filterDocument: draft },
							});
							setDraft(parseFilterDocument(saved.filterDocument));
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
	);
}
