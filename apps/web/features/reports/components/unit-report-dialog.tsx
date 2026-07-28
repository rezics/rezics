"use client";

import {
	PostApiRealmsByRealmIdUnitsByUnitIdReportsRequestReasonEnum,
	useGetApiReportsUnitsByUnitIdRealms,
	usePostApiRealmsByRealmIdUnitsByUnitIdReports,
	type PostApiRealmsByRealmIdUnitsByUnitIdReportsRequestReasonEnum as ReportReason,
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

const ReportReasons = Object.values(PostApiRealmsByRealmIdUnitsByUnitIdReportsRequestReasonEnum);

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
	const [selectedRealmId, setSelectedRealmId] = useState("");
	const [reason, setReason] = useState<ReportReason>("realm_rules");
	const [details, setDetails] = useState("");
	const destinations = useGetApiReportsUnitsByUnitIdRealms(
		{
			path: { unitId },
			query: { localizationLanguages },
		},
		{ query: { enabled: open && !realmId } },
	);
	const submitReport = usePostApiRealmsByRealmIdUnitsByUnitIdReports();
	const effectiveRealmId = realmId ?? (selectedRealmId || destinations.data?.items[0]?.id);
	const canSubmit = Boolean(effectiveRealmId) && !submitReport.isPending;

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!effectiveRealmId || submitReport.isPending) return;
		const normalizedDetails = details.trim();
		try {
			await submitReport.mutateAsync({
				path: { realmId: effectiveRealmId, unitId },
				body: {
					reason,
					...(normalizedDetails ? { details: normalizedDetails } : {}),
				},
			});
			setDetails("");
			setReason("realm_rules");
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
				<DialogHeader
					description={
						realmId ? t.reports.currentRealmDescription : t.reports.description
					}
					title={t.reports.title}
				/>
				<DialogBody>
					<form className="grid gap-4" id={`report-unit-${unitId}`} onSubmit={submit}>
						{realmId ? null : (
							<Field required>
								<FieldLabel>{t.reports.realm}</FieldLabel>
								<NativeSelect
									disabled={
										destinations.isPending || !destinations.data?.items.length
									}
									onChange={(event) =>
										setSelectedRealmId(event.currentTarget.value)
									}
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
						)}
						<Field required>
							<FieldLabel>{t.reports.reason}</FieldLabel>
							<NativeSelect
								onChange={(event) => {
									const value = event.currentTarget.value;
									const next = ReportReasons.find(
										(candidate) => candidate === value,
									);
									if (next) setReason(next);
								}}
								value={reason}
							>
								{ReportReasons.map((value) => (
									<NativeSelectOption key={value} value={value}>
										{t.reports.reasons[value]}
									</NativeSelectOption>
								))}
							</NativeSelect>
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
						<RequestFailure error={submitReport.error ?? destinations.error} />
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
