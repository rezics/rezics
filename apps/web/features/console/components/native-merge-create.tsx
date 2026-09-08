"use client";
import { useState } from "react";
import { usePreflightNativeMerge, useProposeNativeMerge } from "@rezics/openapi-tanstack-query";
import { Button } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { DefinitionText } from "@/features/catalog-definitions/components/definition-fields";
import { GovernanceRulePicker } from "@/features/governance/components/governance-rule-picker";
import type { GovernanceRuleReference } from "@/features/governance/model/governance-rule-selection";
import {
	initialNativeMergePlan,
	NativeMergeManifest,
	NativeMergePlanFields,
} from "./native-merge-plan";

export function NativeMergeCreate({
	initialSource,
	onCreated,
}: {
	initialSource: string;
	onCreated: (id: string) => void;
}) {
	const { t } = useTranslation(["console"]),
		copy = t.console.unitMerges;
	const [source, setSource] = useState(initialSource),
		[target, setTarget] = useState("");
	const [plan, setPlan] = useState(initialNativeMergePlan),
		[rules, setRules] = useState<GovernanceRuleReference[]>([]),
		[note, setNote] = useState("");
	const [confirmSource, setConfirmSource] = useState(""),
		[confirmTarget, setConfirmTarget] = useState("");
	const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
	const preflight = usePreflightNativeMerge(),
		create = useProposeNativeMerge();
	const busy = preflight.isPending || create.isPending;
	const manifest = preflight.data;
	function reset() {
		setIdempotencyKey(crypto.randomUUID());
		preflight.reset();
		create.reset();
		setConfirmSource("");
		setConfirmTarget("");
	}
	async function submit() {
		if (
			!manifest ||
			confirmSource !== manifest.sourceUnit.id ||
			confirmTarget !== manifest.targetUnit.id ||
			!rules.length
		)
			return;
		try {
			const result = await create.mutateAsync({
				body: {
					sourceUnitId: manifest.sourceUnit.id,
					targetUnitId: manifest.targetUnit.id,
					plan: manifest.plan,
					expectedSourceRevision: manifest.sourceRevision,
					expectedTargetRevision: manifest.targetRevision,
					requestFingerprint: manifest.fingerprint,
					confirmationSourceUnitId: confirmSource,
					confirmationTargetUnitId: confirmTarget,
					idempotencyKey,
					rules,
					...(note.trim() ? { note: note.trim() } : {}),
				},
			});
			onCreated(result.id);
		} catch {
			/* The mutation state renders the API failure. */
		}
	}
	return (
		<section className="grid gap-4 rounded-xl border p-5">
			<h2 className="text-lg font-semibold">{copy.createTitle}</h2>
			<div className="grid gap-3 sm:grid-cols-2">
				<DefinitionText
					label={copy.sourceId}
					value={source}
					disabled={busy}
					onChange={(value) => {
						setSource(value.trim());
						reset();
					}}
				/>
				<DefinitionText
					label={copy.targetId}
					value={target}
					disabled={busy}
					onChange={(value) => {
						setTarget(value.trim());
						reset();
					}}
				/>
			</div>
			<NativeMergePlanFields
				value={plan}
				disabled={busy}
				onChange={(value) => {
					setPlan(value);
					reset();
				}}
			/>
			<Button
				variant="outline"
				disabled={busy || !source || !target || source === target}
				onClick={() => {
					void preflight
						.mutateAsync({ body: { sourceUnitId: source, targetUnitId: target, plan } })
						.catch(() => undefined);
				}}
			>
				{copy.preflight}
			</Button>
			{manifest ? (
				<>
					<NativeMergeManifest manifest={manifest} />
					<GovernanceRulePicker
						authority={{ kind: "platform" }}
						value={rules}
						onValueChange={setRules}
						enabled={!busy}
					/>
					<DefinitionText
						label={copy.internalNote}
						value={note}
						onChange={setNote}
						multiline
						disabled={busy}
					/>
					<div className="grid gap-3 sm:grid-cols-2">
						<DefinitionText
							label={copy.confirmSource}
							value={confirmSource}
							onChange={(value) => setConfirmSource(value.trim())}
							disabled={busy}
						/>
						<DefinitionText
							label={copy.confirmTarget}
							value={confirmTarget}
							onChange={(value) => setConfirmTarget(value.trim())}
							disabled={busy}
						/>
					</div>
					<Button
						disabled={
							busy ||
							!rules.length ||
							confirmSource !== manifest.sourceUnit.id ||
							confirmTarget !== manifest.targetUnit.id
						}
						onClick={() => void submit()}
					>
						{copy.submitForReview}
					</Button>
				</>
			) : null}
			<RequestFailure error={preflight.error ?? create.error} />
		</section>
	);
}
