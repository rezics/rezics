"use client";

import {
	getApiReportsMeQueryKey,
	useGetApiReportsUnitsByUnitIdDestinations,
	usePostApiReportsUnitsByUnitId,
} from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Button,
	Checkbox,
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
	Textarea,
	toast,
} from "@rezics/ui";
import { EllipsisIcon, FlagIcon } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuthPortal } from "@/features/auth/auth-portal-context";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import {
	ContentGovernanceMaximumRuleReferences,
	updateContentRuleSelection,
} from "@/features/governance/model/content-rule-selection";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { MyReportsHref } from "../routing/report-routes";

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
	const router = useApplicationRouter();
	const queryClient = useQueryClient();
	const localizationLanguages = useLocalizationLanguages();
	const selectionContextKey = `${unitId}:${realmId ?? ""}`;
	const [ruleSelection, setRuleSelection] = useState({
		contextKey: selectionContextKey,
		keys: [] as string[],
	});
	const [details, setDetails] = useState("");
	const destinations = useGetApiReportsUnitsByUnitIdDestinations(
		{
			path: { unitId },
			query: {
				localizationLanguages,
				...(realmId ? { contextRealmId: realmId } : {}),
			},
		},
		{ query: { enabled: open } },
	);
	const selectedKeys = ruleSelection.contextKey === selectionContextKey ? ruleSelection.keys : [];
	const availableRuleKeys = (destinations.data?.items ?? []).flatMap((destination) =>
		destination.rules.map((rule) => `${destination.id}:${destination.revisionId}:${rule.id}`),
	);
	const currentSelectedKeys = selectedKeys.filter((key) => availableRuleKeys.includes(key));
	const selectedRules = (destinations.data?.items ?? []).flatMap((destination) =>
		destination.rules
			.filter((rule) =>
				currentSelectedKeys.includes(
					`${destination.id}:${destination.revisionId}:${rule.id}`,
				),
			)
			.map((rule) => ({
				sourceRealmId: destination.id,
				revisionId: destination.revisionId,
				ruleId: rule.id,
			})),
	);
	const submitReport = usePostApiReportsUnitsByUnitId();
	const canSubmit = selectedRules.length > 0 && !submitReport.isPending;

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!selectedRules.length || submitReport.isPending) return;
		const normalizedDetails = details.trim();
		try {
			await submitReport.mutateAsync({
				path: { unitId },
				query: { localizationLanguages },
				body: {
					...(realmId ? { contextRealmId: realmId } : {}),
					rules: selectedRules,
					...(normalizedDetails ? { details: normalizedDetails } : {}),
				},
			});
			setDetails("");
			setRuleSelection({ contextKey: selectionContextKey, keys: [] });
			onOpenChange(false);
			await queryClient.invalidateQueries({ queryKey: getApiReportsMeQueryKey() });
			toast.create({
				title: t.reports.submitted,
				description: t.reports.submittedDescription,
				type: "success",
				action: {
					label: t.reports.viewMyReports,
					onClick: () => router.push(MyReportsHref),
				},
			});
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
							<FieldLabel>{t.reports.rule}</FieldLabel>
							<div className="grid gap-3">
								{destinations.data?.items.map((destination) => (
									<fieldset
										className="grid gap-2 rounded-lg border border-border-weak p-3"
										key={destination.id}
									>
										<legend className="flex max-w-full items-center gap-2 px-1 text-sm">
											<span className="truncate font-medium">
												{destination.title ?? destination.id}
											</span>
											<Badge variant="outline">
												{t.reports.myReports.scopes[destination.scope]}
											</Badge>
										</legend>
										{destination.rules.map((rule) => {
											const key = `${destination.id}:${destination.revisionId}:${rule.id}`;
											const checked = currentSelectedKeys.includes(key);
											return (
												<label
													className="flex items-start gap-2 text-sm"
													key={key}
												>
													<Checkbox
														checked={checked}
														disabled={
															!checked &&
															currentSelectedKeys.length >=
																ContentGovernanceMaximumRuleReferences
														}
														onCheckedChange={({ checked }) => {
															setRuleSelection((current) => {
																const keys =
																	current.contextKey ===
																	selectionContextKey
																		? current.keys.filter(
																				(value) =>
																					availableRuleKeys.includes(
																						value,
																					),
																			)
																		: [];
																return {
																	contextKey: selectionContextKey,
																	keys: updateContentRuleSelection(
																		keys,
																		key,
																		checked === true,
																	),
																};
															});
														}}
													/>
													<span>{rule.title}</span>
												</label>
											);
										})}
									</fieldset>
								))}
							</div>
							{destinations.data && !destinations.data.items.length ? (
								<FieldDescription>{t.reports.noRealms}</FieldDescription>
							) : destinations.data &&
								destinations.data.items.every(
									(destination) => !destination.rules.length,
								) ? (
								<FieldDescription>{t.reports.noRules}</FieldDescription>
							) : null}
							<FieldDescription>{t.reports.ruleLimit}</FieldDescription>
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

export function UnitReportOverflowMenu({
	additionalItems,
	realmId,
	unitId,
}: UnitReportTarget & {
	readonly additionalItems?: ReactNode;
}) {
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
					{additionalItems}
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
