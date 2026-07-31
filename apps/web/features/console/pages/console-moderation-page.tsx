"use client";

import { createBlockKey, createPortableTextDocument } from "@rezics/block";
import {
	GetApiReportsPlatformCasesState,
	PostApiGovernanceModerationActionsRequestReasonCodeEnum,
	getApiReportsPlatformCasesQueryKey,
	useGetApiReportsPlatformCases,
	usePostApiGovernanceModerationActions,
	type GetApiReportsPlatformCasesState as PlatformCaseState,
	type GetApiReportsPlatformCasesStatus200,
	type PostApiGovernanceModerationActionsBody,
	type PostApiGovernanceModerationActionsRequestReasonCodeEnum as GovernanceReasonCode,
} from "@rezics/openapi-tanstack-query";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Field,
	FieldLabel,
	ManagementWorkspaceSectionHeader,
	NativeSelect,
	NativeSelectOption,
	QueryFailure,
	QueryPending,
	Textarea,
	toast,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useState, type FormEvent } from "react";

import { publicUnitHref } from "@/features/units/routing/public-unit-route";
import { DraftContentLanguageField } from "@/features/content-languages/components/draft-content-language-field";
import { useDraftContentLanguage } from "@/features/content-languages/hooks/use-draft-content-language";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { useConsoleWorkspace } from "../components/console-workspace";

type PlatformReportCase = GetApiReportsPlatformCasesStatus200["items"][number];
type PlatformCommand = PlatformReportCase["allowedCommands"][number];
type ConfirmedCommand = Extract<PlatformCommand, "remove" | "invalidate_content_license">;

const CaseStates = Object.values(GetApiReportsPlatformCasesState);
const GovernanceReasonCodes = Object.values(
	PostApiGovernanceModerationActionsRequestReasonCodeEnum,
);

function selectCommand(value: string, allowed: readonly PlatformCommand[]): PlatformCommand {
	return allowed.find((command) => command === value) ?? allowed[0] ?? "note";
}

export function ConsoleModerationPage() {
	const { locale, t } = useTranslation(["console", "errors", "realms", "reports"]);
	const { canModerate } = useConsoleWorkspace();
	const localizationLanguages = useLocalizationLanguages();
	const queryClient = useQueryClient();
	const [state, setState] = useState<PlatformCaseState>();
	const [selectedCaseId, setSelectedCaseId] = useState("");
	const [commandSelection, setCommandSelection] = useState({
		caseId: "",
		value: "note" as PlatformCommand,
	});
	const [reasonCode, setReasonCode] = useState<GovernanceReasonCode>("content_policy");
	const [note, setNote] = useState("");
	const noteLanguage = useDraftContentLanguage(note);
	const [confirmedCommand, setConfirmedCommand] = useState<ConfirmedCommand | null>(null);
	const cases = useGetApiReportsPlatformCases(
		{ query: { state, localizationLanguages, limit: 100 } },
		{ query: { enabled: canModerate } },
	);
	const mutation = usePostApiGovernanceModerationActions();

	if (!canModerate) return <p className="text-destructive text-sm">{t.errors.forbidden}</p>;
	if (cases.isPending) return <QueryPending />;
	if (cases.isError || !cases.data)
		return <QueryFailure error={cases.error} retry={() => void cases.refetch()} />;

	const selected =
		cases.data.items.find((item) => item.caseId === selectedCaseId) ?? cases.data.items[0];
	const command =
		selected && commandSelection.caseId === selected.caseId
			? selectCommand(commandSelection.value, selected.allowedCommands)
			: (selected?.allowedCommands[0] ?? "note");
	const noteRequired = command === "note";
	const noteValid = !noteRequired || note.trim().length > 0;

	async function applyModeration() {
		if (!selected || mutation.isPending || !noteValid) return;
		const normalizedNote = note.trim();
		const notes = normalizedNote
			? [
					{
						role: "internal_note" as const,
						language: await noteLanguage.resolveLanguage(normalizedNote),
						content: createPortableTextDocument([
							{
								_type: "block" as const,
								_key: createBlockKey(),
								style: "normal",
								markDefs: [],
								children: [
									{
										_type: "span" as const,
										_key: createBlockKey(),
										text: normalizedNote,
										marks: [],
									},
								],
							},
						]),
					},
				]
			: undefined;
		const common = {
			caseId: selected.caseId,
			reasonCode,
			idempotencyKey: crypto.randomUUID(),
		};
		let body: PostApiGovernanceModerationActionsBody;
		if (command === "note") {
			if (!notes) return;
			body = { ...common, kind: "note", notes };
		} else if (command === "restore_content_license") {
			if (selected.contentLicense?.status !== "invalidated") return;
			body = {
				...common,
				kind: "restore_content_license",
				reversesActionId: selected.contentLicense.invalidationActionId,
				...(notes ? { notes } : {}),
			};
		} else body = { ...common, kind: command, ...(notes ? { notes } : {}) };
		try {
			await mutation.mutateAsync({ body });
			setNote("");
			noteLanguage.enableAutomaticDetection();
			toast.create({ title: t.console.moderation.succeeded, type: "success" });
			await queryClient.invalidateQueries({
				queryKey: getApiReportsPlatformCasesQueryKey(),
			});
		} catch {
			// The typed mutation state renders the localized request failure below.
		}
	}

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!noteValid) return;
		if (command === "remove" || command === "invalidate_content_license") {
			setConfirmedCommand(command);
			return;
		}
		void applyModeration();
	}

	return (
		<section>
			<ManagementWorkspaceSectionHeader
				backHref="/console"
				backLabel={t.console.overview}
				description={t.console.sections.moderation.description}
				link={Link}
				title={t.console.sections.moderation.label}
			/>
			<Card appearance="outlined" className="mb-4">
				<CardContent className="flex flex-wrap items-end gap-3 p-3">
					<Field className="max-w-xs">
						<FieldLabel>{t.console.moderation.filterState}</FieldLabel>
						<NativeSelect
							onChange={(event) => {
								const value = event.currentTarget.value;
								setState(CaseStates.find((candidate) => candidate === value));
								setSelectedCaseId("");
							}}
							value={state ?? ""}
						>
							<NativeSelectOption value="">
								{t.console.moderation.allStates}
							</NativeSelectOption>
							{CaseStates.map((value) => (
								<NativeSelectOption key={value} value={value}>
									{t.reports.caseStates[value]}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
				</CardContent>
			</Card>
			<div className="grid gap-4 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.6fr)]">
				<CaseList
					items={cases.data.items}
					onSelect={setSelectedCaseId}
					selectedCaseId={selected?.caseId}
				/>
				{selected ? (
					<Card appearance="outlined">
						<CardHeader className="border-b">
							<CardTitle>{selected.title ?? t.console.moderation.untitled}</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-6 pt-5">
							<CaseSnapshot item={selected} />
							<div className="grid gap-3">
								<h3 className="font-heading font-bold">
									{t.console.moderation.reports}
								</h3>
								{selected.reports.map((report) => (
									<article
										className="grid gap-2 rounded-lg border p-4 text-sm"
										key={report.id}
									>
										<div className="flex flex-wrap justify-between gap-2">
											<p className="font-medium">{report.rule.title}</p>
											<time
												className="text-muted-foreground text-xs"
												dateTime={report.createdAt}
											>
												{t.reports.reportedAt({
													date: new Intl.DateTimeFormat(locale.current, {
														dateStyle: "medium",
														timeStyle: "short",
													}).format(new Date(report.createdAt)),
												})}
											</time>
										</div>
										{report.details ? (
											<p className="whitespace-pre-wrap rounded-md bg-muted/35 p-3">
												{report.details}
											</p>
										) : null}
									</article>
								))}
							</div>
							<form className="grid gap-4" onSubmit={submit}>
								<div className="grid gap-4 sm:grid-cols-2">
									<Field required>
										<FieldLabel>{t.console.moderation.action}</FieldLabel>
										<NativeSelect
											onChange={(event) =>
												setCommandSelection({
													caseId: selected.caseId,
													value: selectCommand(
														event.currentTarget.value,
														selected.allowedCommands,
													),
												})
											}
											value={command}
										>
											{selected.allowedCommands.map((value) => (
												<NativeSelectOption key={value} value={value}>
													{t.realms.governanceActions[value]}
												</NativeSelectOption>
											))}
										</NativeSelect>
									</Field>
									<Field required>
										<FieldLabel>{t.console.moderation.reason}</FieldLabel>
										<NativeSelect
											onChange={(event) => {
												const value = GovernanceReasonCodes.find(
													(candidate) =>
														candidate === event.currentTarget.value,
												);
												if (value) setReasonCode(value);
											}}
											value={reasonCode}
										>
											{GovernanceReasonCodes.map((value) => (
												<NativeSelectOption key={value} value={value}>
													{t.realms.governanceReasons[value]}
												</NativeSelectOption>
											))}
										</NativeSelect>
									</Field>
								</div>
								<Field required={noteRequired}>
									<FieldLabel>{t.console.moderation.internalNote}</FieldLabel>
									<Textarea
										maxLength={5_000}
										onChange={(event) => setNote(event.currentTarget.value)}
										placeholder={t.console.moderation.notePlaceholder}
										rows={4}
										value={note}
									/>
								</Field>
								<DraftContentLanguageField controller={noteLanguage} />
								<RequestFailure error={mutation.error} />
								<Button
									disabled={!noteValid}
									isLoading={mutation.isPending}
									type="submit"
									variant={
										command === "remove" ||
										command === "invalidate_content_license"
											? "destructive"
											: "solid"
									}
								>
									{t.console.moderation.submit}
								</Button>
							</form>
						</CardContent>
					</Card>
				) : (
					<Card appearance="outlined">
						<CardContent className="py-12 text-center text-muted-foreground text-sm">
							{t.console.moderation.empty}
						</CardContent>
					</Card>
				)}
			</div>
			<AlertDialog
				onOpenChange={({ open }) => {
					if (!mutation.isPending && !open) setConfirmedCommand(null);
				}}
				open={confirmedCommand !== null}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{confirmedCommand === "invalidate_content_license"
								? t.console.moderation.confirmLicenseInvalidationTitle
								: t.console.moderation.confirmRemovalTitle}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{confirmedCommand === "invalidate_content_license"
								? t.console.moderation.confirmLicenseInvalidationDescription({
										title: selected?.title ?? t.console.moderation.untitled,
									})
								: t.console.moderation.confirmRemovalDescription({
										title: selected?.title ?? t.console.moderation.untitled,
									})}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={mutation.isPending}>
							{t.console.cancel}
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={mutation.isPending}
							onClick={() => {
								setConfirmedCommand(null);
								void applyModeration();
							}}
							variant="destructive"
						>
							{confirmedCommand === "invalidate_content_license"
								? t.console.moderation.confirmLicenseInvalidation
								: t.console.moderation.confirmRemoval}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</section>
	);
}

function CaseList({
	items,
	onSelect,
	selectedCaseId,
}: {
	readonly items: readonly PlatformReportCase[];
	readonly onSelect: (caseId: string) => void;
	readonly selectedCaseId?: string;
}) {
	const { t } = useTranslation(["console", "reports"]);
	return (
		<Card appearance="outlined">
			<CardHeader className="border-b">
				<CardTitle>{t.console.moderation.queue}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-1 p-2">
				{items.length ? (
					items.map((item) => (
						<Button
							aria-pressed={selectedCaseId === item.caseId}
							className="h-auto justify-between gap-3 px-3 py-3 text-start"
							key={item.caseId}
							onClick={() => onSelect(item.caseId)}
							type="button"
							variant={selectedCaseId === item.caseId ? "secondary" : "quiet"}
						>
							<span className="min-w-0">
								<span className="block truncate font-medium">
									{item.title ?? t.console.moderation.untitled}
								</span>
								<span className="block text-muted-foreground text-xs">
									{t.reports.caseStates[item.caseState]}
								</span>
							</span>
							<Badge
								variant={Number(item.openReportCount) > 0 ? "warning" : "outline"}
							>
								{t.console.moderation.reportCount({
									count: Number(item.openReportCount),
								})}
							</Badge>
						</Button>
					))
				) : (
					<p className="p-3 text-muted-foreground text-sm">
						{t.console.moderation.empty}
					</p>
				)}
			</CardContent>
		</Card>
	);
}

function CaseSnapshot({ item }: { readonly item: PlatformReportCase }) {
	const { t } = useTranslation(["console", "reports"]);
	const href = publicUnitHref(item.unitKind, { id: item.unitId });
	return (
		<div className="grid gap-2 rounded-lg bg-muted/35 p-4 text-sm">
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant="secondary">
					{t.console.moderation.moderationStatuses[item.moderationStatus]}
				</Badge>
				<Badge variant={item.postTargetingLocked ? "warning" : "outline"}>
					{item.postTargetingLocked
						? t.console.moderation.targetingLocked
						: t.console.moderation.targetingUnlocked}
				</Badge>
				{item.contentLicense ? (
					<Badge
						variant={
							item.contentLicense.status === "invalidated" ? "warning" : "outline"
						}
					>
						{item.contentLicense.status === "invalidated"
							? t.console.moderation.contentLicenseInvalidated
							: t.console.moderation.contentLicenseActive}
					</Badge>
				) : null}
				<Badge variant="outline">{t.reports.caseStates[item.caseState]}</Badge>
			</div>
			{href ? (
				<Link className="w-fit text-primary underline-offset-4 hover:underline" href={href}>
					{t.console.moderation.openContent}
				</Link>
			) : null}
		</div>
	);
}
