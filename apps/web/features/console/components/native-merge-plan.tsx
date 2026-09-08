"use client";
import type { PreflightNativeMergeStatus200 } from "@rezics/openapi-tanstack-query";
import { Badge, Button } from "@rezics/ui";
import { AppLink } from "@/features/application-shell/components/app-link";
import { DefinitionChoice } from "@/features/catalog-definitions/components/definition-fields";
import { useTranslation } from "@/i18n/client";
export type NativeMergePlan = PreflightNativeMergeStatus200["plan"];
export const initialNativeMergePlan: NativeMergePlan = {
	names: "copy_alternates",
	identifiers: "copy_claims",
	semantics: "retain_source",
	structure: "retain_source",
	bindings: "rebind_paused",
	retainedAccess: "target_readers",
};

export function NativeMergePlanFields({
	value,
	onChange,
	disabled,
}: {
	value: NativeMergePlan;
	onChange: (value: NativeMergePlan) => void;
	disabled: boolean;
}) {
	const { t } = useTranslation(["console"]),
		copy = t.console.nativeMerge;
	return (
		<fieldset disabled={disabled} className="grid gap-3">
			<legend className="mb-2 font-medium">{copy.plan}</legend>
			<DefinitionChoice
				label={copy.names}
				value={value.names}
				values={["copy_alternates", "retain_source"]}
				labelFor={(option) => copy.namePlans[option]}
				onChange={(names) => onChange({ ...value, names })}
				disabled={disabled}
			/>
			<DefinitionChoice
				label={copy.identifiers}
				value={value.identifiers}
				values={["copy_claims", "retain_source"]}
				labelFor={(option) => copy.identifierPlans[option]}
				onChange={(identifiers) => onChange({ ...value, identifiers })}
				disabled={disabled}
			/>
			<DefinitionChoice
				label={copy.bindings}
				value={value.bindings}
				values={["rebind_paused", "pause_at_source"]}
				labelFor={(option) => copy.bindingPlans[option]}
				onChange={(bindings) => onChange({ ...value, bindings })}
				disabled={disabled}
			/>
			<p>{copy.retainedContent}</p>
			<p className="rounded border border-warning p-3">{copy.retainedAccess}</p>
		</fieldset>
	);
}

export function NativeMergeManifest({ manifest }: { manifest: PreflightNativeMergeStatus200 }) {
	const { t } = useTranslation(["console"]),
		copy = t.console.nativeMerge;
	return (
		<div className="grid gap-4">
			<div className="grid gap-3 sm:grid-cols-2">
				{(["sourceUnit", "targetUnit"] as const).map((role) => (
					<div key={role} className="grid gap-2 rounded border p-3">
						<h3 className="font-medium">
							{role === "sourceUnit" ? t.console.unitMerges.source : t.console.unitMerges.target}
						</h3>
						<p>{manifest[role].title ?? manifest[role].id}</p>
						<code className="break-all text-xs">{manifest[role].id}</code>
						<p>
							{copy.revision}:{" "}
							{role === "sourceUnit" ? manifest.sourceRevision : manifest.targetRevision}
						</p>
						<Button asChild variant="outline">
							<AppLink href={`/catalog/${manifest.owner}/${manifest[role].id}`}>
								{t.console.unitMerges.openUnit}
							</AppLink>
						</Button>
					</div>
				))}
			</div>
			<div className="flex gap-2">
				<Badge>{copy.visibility[manifest.visibility]}</Badge>
			</div>
			<dl className="grid gap-2">
				<div>
					<dt className="font-medium">{copy.names}</dt>
					<dd>{copy.namePlans[manifest.plan.names]}</dd>
				</div>
				<div>
					<dt className="font-medium">{copy.identifiers}</dt>
					<dd>{copy.identifierPlans[manifest.plan.identifiers]}</dd>
				</div>
				<div>
					<dt className="font-medium">{copy.bindings}</dt>
					<dd>{copy.bindingPlans[manifest.plan.bindings]}</dd>
				</div>
			</dl>
			<p>{copy.retainedContent}</p>
			<p className="rounded border border-warning p-3">{copy.retainedAccess}</p>
			<p className="text-sm">{copy.convergence}</p>
		</div>
	);
}
