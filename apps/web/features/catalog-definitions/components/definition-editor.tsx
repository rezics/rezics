"use client";
import { useState } from "react";
import {
	useCreateCatalogDefinition,
	useReviseCatalogDefinition,
	listCatalogDefinitionsQueryKey,
	getCatalogDefinitionQueryKey,
	listCatalogDefinitionRevisionsQueryKey,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import {
	createDefinitionDraft,
	definitionDraftBody,
	DefinitionKinds,
	DefinitionValueKinds,
	type DefinitionSelection,
} from "../model/definition-draft";
import { DefinitionChoice, DefinitionText } from "./definition-fields";
import { DefinitionConstraintsEditor } from "./definition-constraints-editor";
export function DefinitionEditor({
	selection,
	onSaved,
}: {
	selection?: DefinitionSelection;
	onSaved: (definitionId: string) => void;
}) {
	const { t, locale } = useTranslation(["units"]),
		copy = t.units.nativeDefinitions,
		cache = useQueryClient();
	const [draft, setDraft] = useState(() => createDefinitionDraft(locale.target, selection)),
		[invalid, setInvalid] = useState(false);
	const create = useCreateCatalogDefinition(),
		revise = useReviseCatalogDefinition();
	const pending = create.isPending || revise.isPending;
	return (
		<form
			className="grid gap-5"
			onSubmit={(event) => {
				event.preventDefault();
				if (pending) return;
				const body = definitionDraftBody(draft);
				if (!body) {
					setInvalid(true);
					return;
				}
				setInvalid(false);
				void (async () => {
					const result = selection
						? await revise.mutateAsync({
								path: { id: selection.definitionId },
								body: {
									expectedVersion: selection.revision.version,
									valueKind: body.valueKind,
									constraints: body.constraints,
									labels: body.labels,
									reason: body.reason,
								},
							})
						: await create.mutateAsync({ body });
					await Promise.all([
						cache.invalidateQueries({ queryKey: listCatalogDefinitionsQueryKey() }),
						cache.invalidateQueries({
							queryKey: getCatalogDefinitionQueryKey({ path: { id: result.definitionId } }),
						}),
						cache.invalidateQueries({
							queryKey: listCatalogDefinitionRevisionsQueryKey({
								path: { id: result.definitionId },
							}),
						}),
					]);
					onSaved(result.definitionId);
				})().catch(() => undefined);
			}}
		>
			<p className="text-sm text-muted-foreground">{copy.revisionNotice}</p>
			<div className="grid gap-3 sm:grid-cols-2">
				<DefinitionText
					label={copy.namespace}
					value={draft.namespace}
					required
					disabled={Boolean(selection)}
					onChange={(namespace) => setDraft((current) => ({ ...current, namespace }))}
				/>
				<DefinitionText
					label={copy.key}
					value={draft.key}
					required
					disabled={Boolean(selection)}
					onChange={(key) => setDraft((current) => ({ ...current, key }))}
				/>
			</div>
			<DefinitionChoice
				label={copy.kind}
				value={draft.kind}
				values={DefinitionKinds}
				disabled={Boolean(selection)}
				labelFor={(kind) => copy.kinds[kind]}
				onChange={(kind) =>
					setDraft((current) => ({
						...current,
						kind,
						constraints: { nullable: false, integer: false },
					}))
				}
			/>
			{draft.kind === "property" ? (
				<DefinitionChoice
					label={copy.valueKind}
					value={draft.valueKind}
					values={DefinitionValueKinds}
					labelFor={(kind) => copy.valueKinds[kind]}
					onChange={(valueKind) =>
						setDraft((current) => ({
							...current,
							valueKind,
							constraints: { ...current.constraints, rules: undefined },
						}))
					}
				/>
			) : null}
			<fieldset className="grid gap-3">
				<legend className="mb-3 font-semibold">{copy.labels}</legend>
				{draft.labels.map((label, index) => (
					<div className="grid gap-3 rounded-xl border p-3" key={index}>
						<DefinitionText
							label={copy.language}
							value={label.languageTag}
							required
							onChange={(languageTag) =>
								setDraft((current) => ({
									...current,
									labels: current.labels.map((item, i) =>
										i === index ? { ...item, languageTag } : item,
									),
								}))
							}
						/>
						<DefinitionText
							label={copy.label}
							value={label.label}
							required
							onChange={(text) =>
								setDraft((current) => ({
									...current,
									labels: current.labels.map((item, i) =>
										i === index ? { ...item, label: text } : item,
									),
								}))
							}
						/>
						<DefinitionText
							label={copy.description}
							value={label.description}
							multiline
							onChange={(description) =>
								setDraft((current) => ({
									...current,
									labels: current.labels.map((item, i) =>
										i === index ? { ...item, description } : item,
									),
								}))
							}
						/>
						{draft.labels.length > 1 ? (
							<Button
								type="button"
								variant="ghost"
								onClick={() =>
									setDraft((current) => ({
										...current,
										labels: current.labels.filter((_, i) => i !== index),
									}))
								}
							>
								{copy.remove}
							</Button>
						) : null}
					</div>
				))}
				<Button
					type="button"
					variant="outline"
					disabled={draft.labels.length >= 32}
					onClick={() =>
						setDraft((current) => ({
							...current,
							labels: [...current.labels, { languageTag: "", label: "", description: "" }],
						}))
					}
				>
					{copy.add}
				</Button>
			</fieldset>
			<DefinitionConstraintsEditor
				kind={draft.kind}
				valueKind={draft.valueKind}
				value={draft.constraints}
				onChange={(constraints) => setDraft((current) => ({ ...current, constraints }))}
			/>
			<DefinitionText
				label={copy.reason}
				value={draft.reason}
				required
				multiline
				onChange={(reason) => setDraft((current) => ({ ...current, reason }))}
			/>
			{invalid ? (
				<p className="text-destructive" role="alert">
					{copy.invalid}
				</p>
			) : null}
			<RequestFailure error={create.error ?? revise.error} />
			<Button type="submit" isLoading={pending} disabled={pending}>
				{copy.save}
			</Button>
		</form>
	);
}
