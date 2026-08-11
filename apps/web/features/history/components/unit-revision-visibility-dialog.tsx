"use client";

import {
	PatchApiHistoryUnitRevisionsByRevisionIdVisibilityRequestReasonCodeEnum,
	usePatchApiHistoryUnitRevisionsByRevisionIdVisibility,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Checkbox,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	Field,
	FieldLabel,
	NativeSelect,
	NativeSelectOption,
} from "@rezics/ui";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import {
	buildRevisionVisibility,
	canSetRevisionVisibility,
	revisionHiddenFields,
	revisionVisibilitiesEqual,
	type UnitRevision,
	UnitRevisionHiddenFields,
	type UnitRevisionHiddenField,
	type UnitRevisionVisibilityCapabilities,
	UnitRevisionVisibilityKinds,
	type UnitRevisionVisibilityKind,
} from "../model/revision-visibility";

const GovernanceReasonCodes = Object.values(
	PatchApiHistoryUnitRevisionsByRevisionIdVisibilityRequestReasonCodeEnum,
);
type GovernanceReasonCode = (typeof GovernanceReasonCodes)[number];

export function UnitRevisionVisibilityDialog({
	capabilities,
	onChanged,
	revision,
}: {
	readonly capabilities: UnitRevisionVisibilityCapabilities;
	readonly onChanged: () => Promise<unknown>;
	readonly revision: UnitRevision;
}) {
	const { t } = useTranslation(["history", "realms"]);
	const mutation = usePatchApiHistoryUnitRevisionsByRevisionIdVisibility();
	const [open, setOpen] = useState(false);
	const [kind, setKind] = useState<UnitRevisionVisibilityKind>(revision.visibility.kind);
	const [hiddenFields, setHiddenFields] = useState<UnitRevisionHiddenField[]>(() =>
		revisionHiddenFields(revision.visibility),
	);
	const [reasonCode, setReasonCode] = useState<GovernanceReasonCode | "">("");
	const visibility = buildRevisionVisibility(kind, hiddenFields);
	const currentContentSelected =
		revision.isCurrent && kind !== "visible" && hiddenFields.includes("content");
	const canSave =
		visibility !== null &&
		!mutation.isPending &&
		!currentContentSelected &&
		reasonCode !== "" &&
		canSetRevisionVisibility(revision.visibility.kind, kind, capabilities) &&
		!revisionVisibilitiesEqual(revision.visibility, visibility);

	const openDialog = () => {
		mutation.reset();
		setKind(revision.visibility.kind);
		setHiddenFields(revisionHiddenFields(revision.visibility));
		setReasonCode("");
		setOpen(true);
	};

	const selectKind = (value: string) => {
		const next = UnitRevisionVisibilityKinds.find((candidate) => candidate === value);
		if (next && canSetRevisionVisibility(revision.visibility.kind, next, capabilities))
			setKind(next);
	};

	const toggleField = (field: UnitRevisionHiddenField, checked: boolean) => {
		setHiddenFields((current) =>
			checked
				? current.includes(field)
					? current
					: [...current, field]
				: current.filter((candidate) => candidate !== field),
		);
	};

	const applyCopyrightProtection = () => {
		setKind("suppressed");
		setHiddenFields(["content", "summary"]);
		setReasonCode(
			PatchApiHistoryUnitRevisionsByRevisionIdVisibilityRequestReasonCodeEnum.copyright,
		);
	};

	const save = () => {
		if (!visibility || !reasonCode || !canSave) return;
		mutation.mutate(
			{
				path: { revisionId: revision.id },
				body: { visibility, reasonCode },
			},
			{
				onSuccess: async () => {
					await onChanged();
					setOpen(false);
				},
			},
		);
	};

	return (
		<>
			<Button onClick={openDialog} size="sm" type="button" variant="outline">
				<ShieldCheck aria-hidden data-icon="inline-start" />
				{t.history.visibility.manage}
			</Button>
			<Dialog
				onOpenChange={({ open: nextOpen }) => {
					if (!nextOpen && mutation.isPending) return;
					setOpen(nextOpen);
				}}
				open={open}
			>
				<DialogContent showCloseButton={!mutation.isPending} size="lg">
					<DialogHeader
						description={t.history.visibility.description}
						title={t.history.visibility.title}
					/>
					<DialogBody className="grid gap-5">
						{capabilities.canSuppress ? (
							<div className="rounded-xl border bg-muted/32 p-4">
								<div className="flex flex-wrap items-center justify-between gap-3">
									<div className="min-w-0 flex-1">
										<p className="font-medium text-sm">{t.history.visibility.copyrightPreset}</p>
										<p className="mt-1 text-muted-foreground text-sm">
											{t.history.visibility.copyrightPresetDescription}
										</p>
									</div>
									<Button
										disabled={revision.isCurrent}
										onClick={applyCopyrightProtection}
										size="sm"
										type="button"
										variant="outline"
									>
										{t.history.visibility.copyrightPreset}
									</Button>
								</div>
							</div>
						) : null}

						<Field required>
							<FieldLabel>{t.history.visibility.levelLabel}</FieldLabel>
							<NativeSelect
								onChange={(event) => selectKind(event.currentTarget.value)}
								value={kind}
							>
								{UnitRevisionVisibilityKinds.map((value) => (
									<NativeSelectOption
										disabled={
											!canSetRevisionVisibility(revision.visibility.kind, value, capabilities)
										}
										key={value}
										value={value}
									>
										{t.history.visibility.levels[value]}
									</NativeSelectOption>
								))}
							</NativeSelect>
							<p className="text-muted-foreground text-sm">
								{t.history.visibility.levelDescriptions[kind]}
							</p>
						</Field>

						<fieldset className="grid gap-3" disabled={kind === "visible"}>
							<legend className="font-medium text-sm">{t.history.visibility.fieldsLabel}</legend>
							{UnitRevisionHiddenFields.map((field) => {
								const disabled = kind === "visible" || (revision.isCurrent && field === "content");
								return (
									<label className="flex items-start gap-3 text-sm" key={field}>
										<Checkbox
											checked={hiddenFields.includes(field)}
											disabled={disabled}
											onCheckedChange={(details) => toggleField(field, details.checked === true)}
										/>
										<span>{t.history.visibility.fields[field]}</span>
									</label>
								);
							})}
							{revision.isCurrent ? (
								<p className="text-muted-foreground text-sm">
									{t.history.visibility.currentRevisionContent}
								</p>
							) : null}
							{kind !== "visible" && hiddenFields.length === 0 ? (
								<p className="text-destructive text-sm">{t.history.visibility.atLeastOneField}</p>
							) : null}
						</fieldset>

						<Field required>
							<FieldLabel>{t.history.visibility.reasonLabel}</FieldLabel>
							<NativeSelect
								onChange={(event) => {
									const next = GovernanceReasonCodes.find(
										(candidate) => candidate === event.currentTarget.value,
									);
									if (next) setReasonCode(next);
								}}
								value={reasonCode}
							>
								<NativeSelectOption disabled value="">
									{t.history.visibility.selectReason}
								</NativeSelectOption>
								{GovernanceReasonCodes.map((value) => (
									<NativeSelectOption key={value} value={value}>
										{t.realms.governanceReasons[value]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						<RequestFailure error={mutation.error} />
					</DialogBody>
					<DialogFooter>
						<Button
							disabled={mutation.isPending}
							onClick={() => setOpen(false)}
							type="button"
							variant="outline"
						>
							{t.history.visibility.cancel}
						</Button>
						<Button
							disabled={!canSave}
							isLoading={mutation.isPending}
							onClick={save}
							type="button"
							variant={kind === "suppressed" ? "destructive" : "solid"}
						>
							{t.history.visibility.save}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
