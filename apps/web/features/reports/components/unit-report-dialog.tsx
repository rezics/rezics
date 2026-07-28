"use client";

import {
	useGetApiRealmsByRealmIdRules,
	useGetApiReportsUnitsByUnitIdDestinations,
	usePostApiReportsUnitsByUnitId,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	Field,
	FieldDescription,
	FieldLabel,
	Menu,
	MenuContent,
	MenuItem,
	MenuTrigger,
	NativeSelect,
	NativeSelectOption,
	Textarea,
	toast,
} from "@rezics/ui";
import { EllipsisIcon, FlagIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

import { useAuthPortal } from "@/features/auth/auth-portal";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { selectReportRealmId, selectReportRuleId } from "../model/report-selection";

export type UnitReportTarget = Readonly<{
	unitId: string;
	realmId?: string;
}>;

export function UnitReportDialog({
	open,
	onOpenChange,
	realmId,
	unitId,
}: UnitReportTarget & {
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
}) {
	const { t } = useTranslation(["reports"]);
	const localizationLanguages = useLocalizationLanguages();
	const selectionContextKey = `${unitId}:${realmId ?? ""}`;
	const [realmSelection, setRealmSelection] = useState({
		contextKey: selectionContextKey,
		value: realmId ?? "",
	});
	const [ruleSelection, setRuleSelection] = useState({ realmId: "", value: "" });
	const [details, setDetails] = useState("");
	const destinations = useGetApiReportsUnitsByUnitIdDestinations(
		{
			path: { unitId },
			query: { localizationLanguages },
		},
		{ query: { enabled: open } },
	);
	const selectedRealmId =
		realmSelection.contextKey === selectionContextKey ? realmSelection.value : "";
	const effectiveRealmId = selectReportRealmId(
		destinations.data?.items,
		realmId,
		selectedRealmId,
	);
	const rules = useGetApiRealmsByRealmIdRules(
		{
			path: { realmId: effectiveRealmId ?? "" },
			query: { localizationLanguages },
		},
		{ query: { enabled: open && Boolean(effectiveRealmId) } },
	);
	const selectedRuleId = ruleSelection.realmId === effectiveRealmId ? ruleSelection.value : "";
	const effectiveRuleId = selectReportRuleId(rules.data?.items, selectedRuleId);
	const submitReport = usePostApiReportsUnitsByUnitId();
	const canSubmit = Boolean(effectiveRealmId && effectiveRuleId) && !submitReport.isPending;

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!effectiveRealmId || !effectiveRuleId || submitReport.isPending) return;
		const normalizedDetails = details.trim();
		try {
			await submitReport.mutateAsync({
				path: { unitId },
				query: { localizationLanguages },
				body: {
					ruleRealmId: effectiveRealmId,
					ruleId: effectiveRuleId,
					...(normalizedDetails ? { details: normalizedDetails } : {}),
				},
			});
			setDetails("");
			setRuleSelection({ realmId: "", value: "" });
			onOpenChange(false);
			toast.create({ title: t.reports.submitted, type: "success" });
		} catch {
			// The typed mutation state renders the localized API error below.
		}
	}

	return (
		<Dialog
			onOpenChange={({ open: nextOpen }) => {
				if (!submitReport.isPending) onOpenChange(nextOpen);
			}}
			open={open}
		>
			<DialogContent showCloseButton={!submitReport.isPending} size="sm">
				<DialogHeader description={t.reports.description} title={t.reports.title} />
				<DialogBody>
					<form className="grid gap-4" id={`report-unit-${unitId}`} onSubmit={submit}>
						<Field required>
							<FieldLabel>{t.reports.realm}</FieldLabel>
							<NativeSelect
								disabled={
									destinations.isPending || !destinations.data?.items.length
								}
								onChange={(event) => {
									const value = event.currentTarget.value;
									setRealmSelection({ contextKey: selectionContextKey, value });
									setRuleSelection({ realmId: value, value: "" });
								}}
								value={effectiveRealmId ?? ""}
							>
								{destinations.data?.items.length ? null : (
									<NativeSelectOption value="">
										{t.reports.chooseRealm}
									</NativeSelectOption>
								)}
								{destinations.data?.items.map((item) => (
									<NativeSelectOption key={item.id} value={item.id}>
										{item.title ?? item.id}
									</NativeSelectOption>
								))}
							</NativeSelect>
							{destinations.data && !destinations.data.items.length ? (
								<FieldDescription>{t.reports.noRealms}</FieldDescription>
							) : null}
						</Field>
						<Field required>
							<FieldLabel>{t.reports.rule}</FieldLabel>
							<NativeSelect
								disabled={rules.isPending || !rules.data?.items.length}
								onChange={(event) => {
									if (!effectiveRealmId) return;
									setRuleSelection({
										realmId: effectiveRealmId,
										value: event.currentTarget.value,
									});
								}}
								value={effectiveRuleId ?? ""}
							>
								{rules.data?.items.length ? null : (
									<NativeSelectOption value="">
										{t.reports.chooseRule}
									</NativeSelectOption>
								)}
								{rules.data?.items.map((item) => (
									<NativeSelectOption key={item.id} value={item.id}>
										{item.title}
									</NativeSelectOption>
								))}
							</NativeSelect>
							{rules.data && !rules.data.items.length ? (
								<FieldDescription>{t.reports.noRules}</FieldDescription>
							) : null}
						</Field>
						<Field>
							<FieldLabel>{t.reports.details}</FieldLabel>
							<Textarea
								maxLength={2_000}
								onChange={(event) => setDetails(event.currentTarget.value)}
								placeholder={t.reports.detailsPlaceholder}
								rows={5}
								value={details}
							/>
							<FieldDescription>{t.reports.detailsHint}</FieldDescription>
						</Field>
						<RequestFailure
							error={submitReport.error ?? destinations.error ?? rules.error}
						/>
					</form>
				</DialogBody>
				<DialogFooter>
					<Button
						disabled={submitReport.isPending}
						onClick={() => onOpenChange(false)}
						type="button"
						variant="outline"
					>
						{t.reports.cancel}
					</Button>
					<Button
						disabled={!canSubmit}
						form={`report-unit-${unitId}`}
						isLoading={submitReport.isPending}
						type="submit"
					>
						{t.reports.submit}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function UnitReportOverflowMenu({ realmId, unitId }: UnitReportTarget) {
	const { t } = useTranslation(["reports"]);
	const { data: session } = useHydratedSession();
	const { openAuthPortal } = useAuthPortal();
	const [open, setOpen] = useState(false);

	function requestReport() {
		if (session) setOpen(true);
		else openAuthPortal("login");
	}

	return (
		<>
			<Menu>
				<MenuTrigger asChild>
					<Button
						aria-label={t.reports.moreActions}
						className="data-[state=open]:bg-accent"
						pill
						size="icon-md"
						variant="quiet"
					>
						<EllipsisIcon aria-hidden />
					</Button>
				</MenuTrigger>
				<MenuContent>
					<UnitReportMenuItem onSelect={requestReport} />
				</MenuContent>
			</Menu>
			<UnitReportDialog
				onOpenChange={setOpen}
				open={open}
				realmId={realmId}
				unitId={unitId}
			/>
		</>
	);
}

export function UnitReportMenuItem({ onSelect }: { readonly onSelect: () => void }) {
	const { t } = useTranslation(["reports"]);
	return (
		<MenuItem onSelect={onSelect} value="report-unit">
			<FlagIcon aria-hidden />
			{t.reports.action}
		</MenuItem>
	);
}
