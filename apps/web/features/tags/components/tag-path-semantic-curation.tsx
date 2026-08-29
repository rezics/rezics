"use client";

import type { GetApiTagPathsByPathIdStatus200 } from "@rezics/openapi-tanstack-query";
import {
	useDeleteApiTagExpressionsByExpressionIdInferenceRulesByRuleId,
	useDeleteApiTagPathsByPathIdSensesBySenseId,
	useGetApiUsersMe,
	usePostApiTagExpressions,
	usePostApiTagExpressionsByExpressionIdInferenceRules,
	usePostApiTagPathsByPathIdSenses,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Card,
	CardContent,
	EntityPicker,
	Input,
	NativeSelect,
	NativeSelectOption,
} from "@rezics/ui";
import { useEffect, useMemo, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useHydratedSession } from "@/lib/use-hydrated-session";

type TagPathDetail = GetApiTagPathsByPathIdStatus200;
type PickedUnit = { readonly id: string; readonly label: string };
type ExpressionKind = "simple" | "facet_value" | "relation";
type SenseScope = "global" | "realm";
type InferenceKind = "entailed" | "retrieval_only";
type InferenceTarget = "tag" | "expression";

export function TagPathSemanticCuration({
	onChanged,
	path,
}: {
	readonly onChanged: () => void;
	readonly path: TagPathDetail;
}) {
	const { t } = useTranslation(["tags", "ui"]);
	const { data: session } = useHydratedSession();
	const me = useGetApiUsersMe({}, { query: { enabled: Boolean(session) } });
	const canCurate = Boolean(me.data?.platformCapabilities.includes("unit.merge.propose"));
	const conceptMembers = useMemo(
		() => path.members.filter((member) => member.nodeKind === "concept"),
		[path.members],
	);
	const defaultFocusOrdinal = conceptMembers.at(-1)?.ordinal.toString() ?? "";
	const defaultPredicateOrdinal = conceptMembers[0]?.ordinal.toString() ?? "";
	const defaultSlotOrdinal = (conceptMembers.at(-2) ?? conceptMembers[0])?.ordinal.toString() ?? "";
	const [expressionKind, setExpressionKind] = useState<ExpressionKind>("simple");
	const [focusOrdinal, setFocusOrdinal] = useState(defaultFocusOrdinal);
	const [predicateOrdinal, setPredicateOrdinal] = useState(defaultPredicateOrdinal);
	const [slotOrdinal, setSlotOrdinal] = useState(defaultSlotOrdinal);
	const [scope, setScope] = useState<SenseScope>("global");
	const [realm, setRealm] = useState<PickedUnit>();
	const [selectedSenseId, setSelectedSenseId] = useState(path.senses[0]?.senseId ?? "");
	const [inferenceKind, setInferenceKind] = useState<InferenceKind>("entailed");
	const [inferenceTarget, setInferenceTarget] = useState<InferenceTarget>("tag");
	const [targetTag, setTargetTag] = useState<PickedUnit>();
	const [targetExpressionId, setTargetExpressionId] = useState("");
	const createExpression = usePostApiTagExpressions();
	const createSense = usePostApiTagPathsByPathIdSenses();
	const createInference = usePostApiTagExpressionsByExpressionIdInferenceRules();
	const retireSense = useDeleteApiTagPathsByPathIdSensesBySenseId();
	const retireInference = useDeleteApiTagExpressionsByExpressionIdInferenceRulesByRuleId();
	const activeSenses = useMemo(
		() => path.senses.filter((sense) => sense.status === "active"),
		[path.senses],
	);
	const activeRules = useMemo(() => {
		const rules = new Map<
			string,
			{
				readonly expressionId: string;
				readonly rule: TagPathDetail["senses"][number]["inferenceRules"][number];
			}
		>();
		for (const sense of path.senses) {
			if (!sense.expression) continue;
			for (const rule of sense.inferenceRules)
				if (rule.status === "active" && !rules.has(rule.ruleId))
					rules.set(rule.ruleId, {
						expressionId: sense.expression.expressionId,
						rule,
					});
		}
		return [...rules.values()];
	}, [path.senses]);

	useEffect(() => {
		if (!path.senses.some((sense) => sense.senseId === selectedSenseId))
			setSelectedSenseId(path.senses[0]?.senseId ?? "");
	}, [path.senses, selectedSenseId]);

	if (!canCurate) return null;

	const memberAt = (ordinal: string) =>
		path.members.find((member) => member.ordinal.toString() === ordinal);
	const focus = memberAt(focusOrdinal);
	const predicate = memberAt(predicateOrdinal);
	const slot = memberAt(slotOrdinal);
	const selectedSense = path.senses.find((sense) => sense.senseId === selectedSenseId);
	const senseReady =
		Boolean(focus) &&
		(expressionKind === "simple" ||
			(expressionKind === "facet_value" && Boolean(slot) && slot?.nodeId !== focus?.nodeId) ||
			(expressionKind === "relation" &&
				Boolean(predicate) &&
				predicate?.nodeId !== focus?.nodeId)) &&
		(scope === "global" || Boolean(realm));

	async function submitSense() {
		if (!focus || !senseReady) return;
		const semantics =
			expressionKind === "simple"
				? {
						canonicalClaimKey: `tag:${focus.nodeId}`,
						focusTagId: focus.nodeId,
						arguments: [{ role: "focus" as const, ordinal: 0, tagId: focus.nodeId }],
						labelComponents: [
							{
								tagId: focus.nodeId,
								semanticRole: "focus" as const,
								componentKind: "required" as const,
							},
						],
						groupKey: null,
						bindings: [
							{
								memberOrdinal: Number(focus.ordinal),
								argumentRole: "focus" as const,
								argumentOrdinal: 0,
							},
						],
					}
				: expressionKind === "facet_value" && slot
					? {
							canonicalClaimKey: `facet-value:${slot.nodeId}:${focus.nodeId}`,
							focusTagId: focus.nodeId,
							arguments: [
								{ role: "slot" as const, ordinal: 0, tagId: slot.nodeId },
								{ role: "value" as const, ordinal: 0, tagId: focus.nodeId },
							],
							labelComponents: [
								{
									tagId: slot.nodeId,
									semanticRole: "slot" as const,
									componentKind: "required" as const,
								},
								{
									tagId: focus.nodeId,
									semanticRole: "value" as const,
									componentKind: "required" as const,
								},
							],
							groupKey: { tagId: slot.nodeId, semanticRole: "slot" as const },
							bindings: [
								{
									memberOrdinal: Number(slot.ordinal),
									argumentRole: "slot" as const,
									argumentOrdinal: 0,
								},
								{
									memberOrdinal: Number(focus.ordinal),
									argumentRole: "value" as const,
									argumentOrdinal: 0,
								},
							],
						}
					: expressionKind === "relation" && predicate
						? {
								canonicalClaimKey: `relation:${predicate.nodeId}:${focus.nodeId}`,
								focusTagId: focus.nodeId,
								arguments: [
									{ role: "predicate" as const, ordinal: 0, tagId: predicate.nodeId },
									{ role: "focus" as const, ordinal: 0, tagId: focus.nodeId },
								],
								labelComponents: [
									{
										tagId: predicate.nodeId,
										semanticRole: "predicate" as const,
										componentKind: "required" as const,
									},
									{
										tagId: focus.nodeId,
										semanticRole: "focus" as const,
										componentKind: "required" as const,
									},
								],
								groupKey: { tagId: predicate.nodeId, semanticRole: "predicate" as const },
								bindings: [
									{
										memberOrdinal: Number(predicate.ordinal),
										argumentRole: "predicate" as const,
										argumentOrdinal: 0,
									},
									{
										memberOrdinal: Number(focus.ordinal),
										argumentRole: "focus" as const,
										argumentOrdinal: 0,
									},
								],
							}
						: null;
		if (!semantics) return;
		const expression = await createExpression.mutateAsync({
			body: {
				expressionKind,
				canonicalClaimKey: semantics.canonicalClaimKey,
				focusTagId: semantics.focusTagId,
				arguments: semantics.arguments,
				labelComponents: semantics.labelComponents,
				groupKey: semantics.groupKey,
			},
		});
		await createSense.mutateAsync({
			path: { pathId: path.pathId },
			body: {
				expressionId: expression.expressionId,
				scope,
				...(scope === "realm" && realm ? { realmId: realm.id } : {}),
				bindings: semantics.bindings,
				provenance: { surface: "path_detail_curation" },
			},
		});
		onChanged();
	}

	async function submitInference() {
		if (!selectedSense?.expression) return;
		if (inferenceTarget === "tag" && !targetTag) return;
		if (inferenceTarget === "expression" && !targetExpressionId.trim()) return;
		await createInference.mutateAsync({
			path: { expressionId: selectedSense.expression.expressionId },
			body: {
				inferenceKind,
				...(inferenceTarget === "tag" && targetTag
					? { targetTagId: targetTag.id }
					: { targetExpressionId: targetExpressionId.trim() }),
				provenance: { surface: "path_detail_curation" },
			},
		});
		setTargetTag(undefined);
		setTargetExpressionId("");
		onChanged();
	}

	async function submitSenseRetirement(senseId: string) {
		if (!window.confirm(t.tags.semantics.retireSenseConfirm)) return;
		await retireSense.mutateAsync({ path: { pathId: path.pathId, senseId } });
		onChanged();
	}

	async function submitInferenceRetirement(expressionId: string, ruleId: string) {
		if (!window.confirm(t.tags.semantics.retireInferenceConfirm)) return;
		await retireInference.mutateAsync({ path: { expressionId, ruleId } });
		onChanged();
	}

	const memberOptions = conceptMembers.map((member) => ({
		value: member.ordinal.toString(),
		label: member.title ?? t.tags.paths.memberFallback,
	}));
	const pending = createExpression.isPending || createSense.isPending;
	return (
		<section className="grid gap-4" aria-labelledby="tag-path-curation-title">
			<div className="grid gap-1">
				<h2 className="font-heading text-xl font-bold" id="tag-path-curation-title">
					{t.tags.semantics.curationTitle}
				</h2>
				<p className="text-sm text-muted-foreground">{t.tags.semantics.curationDescription}</p>
			</div>
			<Card>
				<CardContent className="grid gap-4 p-5">
					<h3 className="font-semibold">{t.tags.semantics.createSense}</h3>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field label={t.tags.semantics.expressionKind}>
							<NativeSelect
								onChange={(event) => setExpressionKind(event.currentTarget.value as ExpressionKind)}
								value={expressionKind}
							>
								<NativeSelectOption value="simple">
									{t.tags.semantics.expressionKinds.simple}
								</NativeSelectOption>
								<NativeSelectOption value="facet_value">
									{t.tags.semantics.expressionKinds.facet_value}
								</NativeSelectOption>
								<NativeSelectOption value="relation">
									{t.tags.semantics.expressionKinds.relation}
								</NativeSelectOption>
							</NativeSelect>
						</Field>
						<MemberField
							label={
								expressionKind === "facet_value" ? t.tags.semantics.value : t.tags.semantics.focus
							}
							onChange={setFocusOrdinal}
							options={memberOptions}
							value={focusOrdinal}
						/>
						{expressionKind === "facet_value" ? (
							<MemberField
								label={t.tags.semantics.slot}
								onChange={setSlotOrdinal}
								options={memberOptions}
								value={slotOrdinal}
							/>
						) : null}
						{expressionKind === "relation" ? (
							<MemberField
								label={t.tags.semantics.predicate}
								onChange={setPredicateOrdinal}
								options={memberOptions}
								value={predicateOrdinal}
							/>
						) : null}
						<Field label={t.tags.semantics.scope}>
							<NativeSelect
								onChange={(event) => setScope(event.currentTarget.value as SenseScope)}
								value={scope}
							>
								<NativeSelectOption value="global">
									{t.tags.semantics.globalScope}
								</NativeSelectOption>
								<NativeSelectOption value="realm">{t.tags.semantics.realmScope}</NativeSelectOption>
							</NativeSelect>
						</Field>
						{scope === "realm" ? (
							<Field label={t.tags.semantics.realmScope}>
								<EntityPicker
									ariaLabel={t.tags.semantics.realmScope}
									index="realms"
									onChange={setRealm}
									placeholder={t.ui.pickerPlaceholders.realm}
									value={realm}
								/>
							</Field>
						) : null}
					</div>
					<Button
						disabled={!senseReady}
						isLoading={pending}
						onClick={() => void submitSense().catch(() => undefined)}
						type="button"
					>
						{t.tags.semantics.createSenseAction}
					</Button>
					<RequestFailure
						error={createExpression.error ?? createSense.error}
						fallback={t.ui.retryLater}
					/>
				</CardContent>
			</Card>
			{path.senses.length ? (
				<Card>
					<CardContent className="grid gap-4 p-5">
						<h3 className="font-semibold">{t.tags.semantics.addInference}</h3>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field label={t.tags.semantics.sense}>
								<NativeSelect
									onChange={(event) => setSelectedSenseId(event.currentTarget.value)}
									value={selectedSenseId}
								>
									{path.senses.map((sense) => (
										<NativeSelectOption key={sense.senseId} value={sense.senseId}>
											{sense.expression?.components
												.map((component) => component.title ?? t.tags.paths.memberFallback)
												.join(" · ") ?? sense.senseId}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Field>
							<Field label={t.tags.semantics.inferenceKind}>
								<NativeSelect
									onChange={(event) => setInferenceKind(event.currentTarget.value as InferenceKind)}
									value={inferenceKind}
								>
									<NativeSelectOption value="entailed">
										{t.tags.semantics.inferenceKinds.entailed}
									</NativeSelectOption>
									<NativeSelectOption value="retrieval_only">
										{t.tags.semantics.inferenceKinds.retrieval_only}
									</NativeSelectOption>
								</NativeSelect>
							</Field>
							<Field label={t.tags.semantics.inferenceTarget}>
								<NativeSelect
									onChange={(event) =>
										setInferenceTarget(event.currentTarget.value as InferenceTarget)
									}
									value={inferenceTarget}
								>
									<NativeSelectOption value="tag">{t.tags.semantics.targetTag}</NativeSelectOption>
									<NativeSelectOption value="expression">
										{t.tags.semantics.targetExpression}
									</NativeSelectOption>
								</NativeSelect>
							</Field>
							{inferenceTarget === "tag" ? (
								<Field label={t.tags.semantics.targetTag}>
									<EntityPicker
										ariaLabel={t.tags.semantics.targetTag}
										index="tags"
										onChange={setTargetTag}
										placeholder={t.ui.pickerPlaceholders.tag}
										value={targetTag}
									/>
								</Field>
							) : (
								<Field label={t.tags.semantics.expressionId}>
									<Input
										onChange={(event) => setTargetExpressionId(event.currentTarget.value)}
										placeholder={t.tags.semantics.expressionIdPlaceholder}
										value={targetExpressionId}
									/>
								</Field>
							)}
						</div>
						<Button
							disabled={
								!selectedSense?.expression ||
								(inferenceTarget === "tag" ? !targetTag : !targetExpressionId.trim())
							}
							isLoading={createInference.isPending}
							onClick={() => void submitInference().catch(() => undefined)}
							type="button"
						>
							{t.tags.semantics.addInferenceAction}
						</Button>
						<RequestFailure error={createInference.error} fallback={t.ui.retryLater} />
					</CardContent>
				</Card>
			) : null}
			{activeSenses.length || activeRules.length ? (
				<Card>
					<CardContent className="grid gap-4 p-5">
						<div className="grid gap-1">
							<h3 className="font-semibold">{t.tags.semantics.lifecycleTitle}</h3>
							<p className="text-sm text-muted-foreground">
								{t.tags.semantics.lifecycleDescription}
							</p>
						</div>
						{activeSenses.map((sense) => (
							<div
								className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-weak p-3"
								key={sense.senseId}
							>
								<span className="min-w-0 text-sm font-medium">
									{sense.expression?.components
										.map((component) => component.title ?? t.tags.paths.memberFallback)
										.join(" · ") ?? sense.senseId}
								</span>
								<Button
									isLoading={retireSense.isPending}
									onClick={() => void submitSenseRetirement(sense.senseId).catch(() => undefined)}
									size="sm"
									type="button"
									variant="destructive"
								>
									{t.tags.semantics.retireSenseAction}
								</Button>
							</div>
						))}
						{activeRules.map(({ expressionId, rule }) => (
							<div
								className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-weak p-3"
								key={rule.ruleId}
							>
								<span className="min-w-0 text-sm font-medium">
									{t.tags.semantics.inferenceKinds[rule.inferenceKind]} ·{" "}
									{rule.target.kind === "tag"
										? (rule.target.title ?? t.tags.unnamedTag)
										: rule.target.expressionId}
								</span>
								<Button
									isLoading={retireInference.isPending}
									onClick={() =>
										void submitInferenceRetirement(expressionId, rule.ruleId).catch(() => undefined)
									}
									size="sm"
									type="button"
									variant="destructive"
								>
									{t.tags.semantics.retireInferenceAction}
								</Button>
							</div>
						))}
						<RequestFailure
							error={retireSense.error ?? retireInference.error}
							fallback={t.ui.retryLater}
						/>
					</CardContent>
				</Card>
			) : null}
		</section>
	);
}

function Field({
	children,
	label,
}: {
	readonly children: React.ReactNode;
	readonly label: string;
}) {
	return (
		<label className="grid gap-1.5 text-sm font-medium">
			<span>{label}</span>
			{children}
		</label>
	);
}

function MemberField({
	label,
	onChange,
	options,
	value,
}: {
	readonly label: string;
	readonly onChange: (value: string) => void;
	readonly options: readonly { readonly label: string; readonly value: string }[];
	readonly value: string;
}) {
	return (
		<Field label={label}>
			<NativeSelect onChange={(event) => onChange(event.currentTarget.value)} value={value}>
				{options.map((option) => (
					<NativeSelectOption key={option.value} value={option.value}>
						{option.label}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}
