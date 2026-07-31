"use client";

import type {
	GetApiUnitsByTypeByUnitIdStatus200,
	GetApiUnitByUnitIdAssociationProposalsStatus200,
} from "@rezics/openapi-tanstack-query";
import {
	getApiUnitByUnitIdAssociationProposalsQueryKey,
	useDeleteApiUnitByUnitIdAssociationProposalsByProposalId,
	useDeleteApiUnitsByTypeByUnitIdCreditAttributionsByAssociationId,
	useDeleteApiUnitsByTypeByUnitIdLinksByLinkId,
	useDeleteApiUnitsByTypeByUnitIdSubjectAssociationsByAssociationId,
	useGetApiUnitByUnitIdAssociationProposals,
	usePatchApiUnitsByTypeByUnitIdVariantContext,
	usePostApiUnitByUnitIdAssociationProposalsByProposalIdAccept,
	usePostApiUnitByUnitIdAssociationProposalsByProposalIdDecline,
	usePostApiUnitByUnitIdAssociationProposalsRequests,
	usePostApiUnitsByTypeByUnitIdCreditAttributions,
	usePostApiUnitsByTypeByUnitIdLinks,
	usePostApiUnitsByTypeByUnitIdSubjectAssociations,
	usePostApiUnitsByTypeByUnitIdVariantContextPromote,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogBody,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	EntityPicker,
	Field,
	FieldLabel,
	IdentityAvatar,
	Input,
	NativeSelect,
	NativeSelectOption,
	QueryFailure,
	QueryPending,
	toast,
	type EntitySearch,
	type UnitMentionPresentation,
	UnitPicker,
	useEntitySearch,
	useUnitMentionResolver,
} from "@rezics/ui";
import {
	ArrowUpRight,
	ExternalLink,
	GitBranch,
	Link2,
	Plus,
	Trash2,
	UserRound,
	UsersRound,
} from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { hasErrorCode } from "@/i18n/errors";
import { RequestFailure } from "@/i18n/request-failure";
import {
	CreditAttributionRolesByUnitType,
	isCreditAttributionRoleForUnitType,
	isKnownAttributionRole,
	isSubjectAssociationRole,
	SubjectAssociationRoles,
	type CreditAttributionRole,
	type SubjectAssociationRole,
} from "../attribution-role";
import { invalidateUnitDetail } from "../unit-cache";
import { isVariantUnitType, type VariantUnitType, type WorkUnitType } from "../unit-types";

type Unit = GetApiUnitsByTypeByUnitIdStatus200;
type SelectedEntity = { readonly id: string; readonly label: string };
type Proposal = GetApiUnitByUnitIdAssociationProposalsStatus200["items"][number];
type AssociationKind = "credit" | "subject";
type ProposalQueryState = {
	readonly data?: GetApiUnitByUnitIdAssociationProposalsStatus200;
	readonly error: unknown;
	readonly isError: boolean;
	readonly isPending: boolean;
	readonly refetch: () => Promise<unknown>;
};

type PendingAssociationRequest =
	| {
			readonly kind: "credit";
			readonly targetUnitId: string;
			readonly role: CreditAttributionRole;
	  }
	| {
			readonly kind: "subject";
			readonly targetUnitId: string;
			readonly role: SubjectAssociationRole;
			readonly contextPostId?: string;
	  };

const AssociationRequestLifetimeDays = 14;

function futureIsoDate(days: number): string {
	return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function presentationFallback(
	presentation: UnitMentionPresentation | undefined,
	fallback: string,
): string {
	return presentation?.label || fallback;
}

function useResolvedUnitPresentations(
	unitIds: readonly string[],
): ReadonlyMap<string, UnitMentionPresentation> {
	const resolve = useUnitMentionResolver();
	const key = [...new Set(unitIds)].sort().join("\u0000");
	const [presentations, setPresentations] = useState<
		ReadonlyMap<string, UnitMentionPresentation>
	>(new Map());

	useEffect(() => {
		if (!resolve || !key) {
			setPresentations(new Map());
			return;
		}
		const controller = new AbortController();
		void resolve(key.split("\u0000"), controller.signal).then(
			(items) => {
				if (!controller.signal.aborted)
					setPresentations(new Map(items.map((item) => [item.id, item])));
			},
			() => {
				if (!controller.signal.aborted) setPresentations(new Map());
			},
		);
		return () => controller.abort();
	}, [key, resolve]);

	return presentations;
}

function RelationshipSection({
	action,
	children,
	count,
	description,
	icon: Icon,
	title,
}: {
	readonly action?: ReactNode;
	readonly children: ReactNode;
	readonly count: number;
	readonly description: string;
	readonly icon: typeof UserRound;
	readonly title: string;
}) {
	return (
		<Card appearance="outlined">
			<CardHeader className="gap-4 border-b border-border-weak sm:flex sm:items-start sm:justify-between">
				<div className="flex min-w-0 gap-3">
					<div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
						<Icon aria-hidden className="size-4" />
					</div>
					<div className="grid min-w-0 gap-1">
						<div className="flex flex-wrap items-center gap-2">
							<CardTitle>{title}</CardTitle>
							<Badge size="sm" variant="secondary">
								{count}
							</Badge>
						</div>
						<CardDescription>{description}</CardDescription>
					</div>
				</div>
				{action ? <div className="shrink-0">{action}</div> : null}
			</CardHeader>
			<CardContent className="p-0">{children}</CardContent>
		</Card>
	);
}

function EmptyRelationshipState({
	description,
	title,
}: {
	readonly description: string;
	readonly title: string;
}) {
	return (
		<div className="grid min-h-32 place-items-center px-5 py-8 text-center">
			<div className="grid max-w-md justify-items-center gap-2">
				<strong className="text-sm">{title}</strong>
				<p className="text-sm leading-6 text-muted-foreground">{description}</p>
			</div>
		</div>
	);
}

function RelationshipRow({
	actions,
	avatar,
	description,
	title,
}: {
	readonly actions?: ReactNode;
	readonly avatar?: UnitMentionPresentation["avatar"];
	readonly description: ReactNode;
	readonly title: string;
}) {
	return (
		<div className="flex min-w-0 items-center gap-3 border-b border-border-weak px-4 py-3 last:border-b-0 sm:px-5">
			<IdentityAvatar
				avatar={avatar}
				className="size-9 shrink-0"
				fallback={title.slice(0, 1).toUpperCase()}
			/>
			<div className="grid min-w-0 flex-1 gap-0.5">
				<strong className="truncate text-sm">{title}</strong>
				<div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
					{description}
				</div>
			</div>
			{actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
		</div>
	);
}

function RemoveRelationshipDialog({
	description,
	label,
	onRemove,
	pending,
	title,
}: {
	readonly description: string;
	readonly label: string;
	readonly onRemove: () => Promise<void>;
	readonly pending: boolean;
	readonly title: string;
}) {
	const { t } = useTranslation(["units"]);
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button aria-label={label} size="icon-md" type="button" variant="quiet">
					<Trash2 aria-hidden className="size-4" />
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent size="sm">
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
				</AlertDialogHeader>
				<AlertDialogBody>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogBody>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={pending}>
						{t.units.relationshipManagement.cancel}
					</AlertDialogCancel>
					<AlertDialogAction
						isLoading={pending}
						onClick={() => void onRemove()}
						variant="destructive"
					>
						{t.units.relationshipManagement.confirmRemove}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

export function AddCreditDialog({
	open,
	onOpenChange,
	onRestricted,
	type,
	unitId,
}: {
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
	readonly onRestricted: (request: PendingAssociationRequest) => void;
	readonly type: WorkUnitType;
	readonly unitId: string;
}) {
	const { t } = useTranslation(["ui", "units"]);
	const queryClient = useQueryClient();
	const searchEntities = useEntitySearch();
	const publicEntitySearch = useMemo<EntitySearch | undefined>(() => {
		if (!searchEntities) return undefined;
		return (index, query, signal, options) =>
			searchEntities(index, query, signal, {
				...options,
				creditAttributionSearch: "public",
			});
	}, [searchEntities]);
	const [entity, setEntity] = useState<SelectedEntity>();
	const create = usePostApiUnitsByTypeByUnitIdCreditAttributions();

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!entity || create.isPending) return;
		const roleValue = String(new FormData(event.currentTarget).get("role") ?? "");
		if (!isCreditAttributionRoleForUnitType(type, roleValue)) return;
		try {
			await create.mutateAsync({
				path: { type, unitId },
				body: { creditedUnitId: entity.id, role: roleValue },
			});
			await invalidateUnitDetail(queryClient, type, unitId);
			setEntity(undefined);
			onOpenChange(false);
			toast.create({
				title: t.units.relationshipManagement.creditAdded,
				type: "success",
			});
		} catch (error) {
			if (hasErrorCode(error, "EntityAssociationRestricted")) {
				create.reset();
				onRestricted({
					kind: "credit",
					targetUnitId: entity.id,
					role: roleValue,
				});
			}
		}
	}

	return (
		<Dialog
			onOpenChange={({ open: nextOpen }) => {
				if (!create.isPending) onOpenChange(nextOpen);
			}}
			open={open}
		>
			<DialogContent showCloseButton={false} size="sm">
				<DialogHeader
					description={t.units.relationshipManagement.addCreditDescription}
					title={t.units.relationshipManagement.addCredit}
				/>
				<form
					className="flex min-h-0 flex-1 flex-col"
					onSubmit={(event) => void submit(event)}
				>
					<DialogBody className="grid gap-4">
						<Field required>
							<FieldLabel>{t.units.relationshipManagement.creditedEntity}</FieldLabel>
							<EntityPicker
								ariaLabel={t.units.relationshipManagement.creditedEntity}
								index="entities"
								onChange={setEntity}
								onClear={() => setEntity(undefined)}
								placeholder={t.ui.pickerPlaceholders.entity}
								search={publicEntitySearch}
								searchOnOpen
								value={entity}
							/>
						</Field>
						<Field required>
							<FieldLabel>{t.units.editor.creditRole}</FieldLabel>
							<NativeSelect name="role" required>
								{CreditAttributionRolesByUnitType[type].map((role) => (
									<NativeSelectOption key={role} value={role}>
										{t.units.attributionRoles[role]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						<RequestFailure error={create.error} fallback={t.ui.retryLater} />
					</DialogBody>
					<DialogFooter>
						<Button
							disabled={create.isPending}
							onClick={() => onOpenChange(false)}
							type="button"
							variant="outline"
						>
							{t.units.relationshipManagement.cancel}
						</Button>
						<Button disabled={!entity} isLoading={create.isPending} type="submit">
							{t.units.relationshipManagement.addCredit}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function AddSubjectDialog({
	open,
	onOpenChange,
	onRestricted,
	type,
	unitId,
}: {
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
	readonly onRestricted: (request: PendingAssociationRequest) => void;
	readonly type: WorkUnitType;
	readonly unitId: string;
}) {
	const { t } = useTranslation(["ui", "units"]);
	const queryClient = useQueryClient();
	const [entity, setEntity] = useState<SelectedEntity>();
	const [contextPost, setContextPost] = useState<SelectedEntity>();
	const create = usePostApiUnitsByTypeByUnitIdSubjectAssociations();

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!entity || create.isPending) return;
		const roleValue = String(new FormData(event.currentTarget).get("role") ?? "");
		if (!isSubjectAssociationRole(roleValue)) return;
		try {
			await create.mutateAsync({
				path: { type, unitId },
				body: {
					entityId: entity.id,
					role: roleValue,
					...(contextPost ? { contextPostId: contextPost.id } : {}),
				},
			});
			await invalidateUnitDetail(queryClient, type, unitId);
			setEntity(undefined);
			setContextPost(undefined);
			onOpenChange(false);
			toast.create({
				title: t.units.relationshipManagement.subjectAdded,
				type: "success",
			});
		} catch (error) {
			if (hasErrorCode(error, "EntityAssociationRestricted")) {
				create.reset();
				onRestricted({
					kind: "subject",
					targetUnitId: entity.id,
					role: roleValue,
					...(contextPost ? { contextPostId: contextPost.id } : {}),
				});
			}
		}
	}

	return (
		<Dialog
			onOpenChange={({ open: nextOpen }) => {
				if (!create.isPending) onOpenChange(nextOpen);
			}}
			open={open}
		>
			<DialogContent showCloseButton={false} size="sm">
				<DialogHeader
					description={t.units.relationshipManagement.addSubjectDescription}
					title={t.units.relationshipManagement.addSubject}
				/>
				<form
					className="flex min-h-0 flex-1 flex-col"
					onSubmit={(event) => void submit(event)}
				>
					<DialogBody className="grid gap-4">
						<Field required>
							<FieldLabel>{t.units.relationshipManagement.subjectEntity}</FieldLabel>
							<EntityPicker
								ariaLabel={t.units.relationshipManagement.subjectEntity}
								index="entities"
								onChange={setEntity}
								onClear={() => setEntity(undefined)}
								placeholder={t.ui.pickerPlaceholders.entity}
								searchOnOpen
								value={entity}
							/>
						</Field>
						<Field required>
							<FieldLabel>{t.units.editor.subjectRole}</FieldLabel>
							<NativeSelect name="role" required>
								{SubjectAssociationRoles.map((role) => (
									<NativeSelectOption key={role} value={role}>
										{t.units.subjectAssociationRoles[role]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel>{t.units.editor.contextWikiPost}</FieldLabel>
							<EntityPicker
								ariaLabel={t.units.editor.contextWikiPost}
								index="posts"
								kind="wiki"
								onChange={setContextPost}
								onClear={() => setContextPost(undefined)}
								placeholder={t.ui.pickerPlaceholders.post}
								value={contextPost}
							/>
						</Field>
						<RequestFailure error={create.error} fallback={t.ui.retryLater} />
					</DialogBody>
					<DialogFooter>
						<Button
							disabled={create.isPending}
							onClick={() => onOpenChange(false)}
							type="button"
							variant="outline"
						>
							{t.units.relationshipManagement.cancel}
						</Button>
						<Button disabled={!entity} isLoading={create.isPending} type="submit">
							{t.units.relationshipManagement.addSubject}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function AddSourceLinkDialog({
	open,
	onOpenChange,
	type,
	unitId,
}: {
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
	readonly type: WorkUnitType;
	readonly unitId: string;
}) {
	const { t } = useTranslation(["ui", "units"]);
	const queryClient = useQueryClient();
	const [source, setSource] = useState<SelectedEntity>();
	const create = usePostApiUnitsByTypeByUnitIdLinks();

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!source || create.isPending) return;
		const form = new FormData(event.currentTarget);
		const url = String(form.get("url") ?? "").trim();
		if (!url) return;
		try {
			await create.mutateAsync({
				path: { type, unitId },
				body: { sourceEntityUnitId: source.id, url },
			});
			await invalidateUnitDetail(queryClient, type, unitId);
			setSource(undefined);
			onOpenChange(false);
			toast.create({
				title: t.units.relationshipManagement.linkAdded,
				type: "success",
			});
		} catch {
			// The typed mutation state renders the localized API error below.
		}
	}

	return (
		<Dialog
			onOpenChange={({ open: nextOpen }) => {
				if (!create.isPending) onOpenChange(nextOpen);
			}}
			open={open}
		>
			<DialogContent showCloseButton={false} size="sm">
				<DialogHeader
					description={t.units.relationshipManagement.addLinkDescription}
					title={t.units.relationshipManagement.addLink}
				/>
				<form
					className="flex min-h-0 flex-1 flex-col"
					onSubmit={(event) => void submit(event)}
				>
					<DialogBody className="grid gap-4">
						<Field required>
							<FieldLabel>{t.units.relationshipManagement.sourceEntity}</FieldLabel>
							<EntityPicker
								ariaLabel={t.units.relationshipManagement.sourceEntity}
								index="entities"
								onChange={setSource}
								onClear={() => setSource(undefined)}
								placeholder={t.ui.pickerPlaceholders.entity}
								searchOnOpen
								value={source}
							/>
						</Field>
						<Field required>
							<FieldLabel>{t.units.editor.linkUrl}</FieldLabel>
							<Input
								name="url"
								placeholder={t.units.relationshipManagement.urlPlaceholder}
								required
								type="url"
							/>
						</Field>
						<RequestFailure error={create.error} fallback={t.ui.retryLater} />
					</DialogBody>
					<DialogFooter>
						<Button
							disabled={create.isPending}
							onClick={() => onOpenChange(false)}
							type="button"
							variant="outline"
						>
							{t.units.relationshipManagement.cancel}
						</Button>
						<Button disabled={!source} isLoading={create.isPending} type="submit">
							{t.units.relationshipManagement.addLink}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function AssociationRequestConfirmation({
	onCancel,
	onRequested,
	pendingRequest,
	unitId,
}: {
	readonly onCancel: () => void;
	readonly onRequested: (kind: AssociationKind) => Promise<void>;
	readonly pendingRequest?: PendingAssociationRequest;
	readonly unitId: string;
}) {
	const { t } = useTranslation(["ui", "units"]);
	const request = usePostApiUnitByUnitIdAssociationProposalsRequests();

	async function confirm() {
		if (!pendingRequest || request.isPending) return;
		try {
			await request.mutateAsync({
				path: { unitId },
				body: {
					...pendingRequest,
					expiresAt: futureIsoDate(AssociationRequestLifetimeDays),
				},
			});
			await onRequested(pendingRequest.kind);
			toast.create({
				title: t.units.relationshipManagement.requestSent,
				description: t.units.relationshipManagement.requestSentDescription,
				type: "success",
			});
			onCancel();
		} catch {
			// The typed mutation state renders the localized API error below.
		}
	}

	return (
		<AlertDialog
			onOpenChange={({ open }) => {
				if (!open && !request.isPending) onCancel();
			}}
			open={Boolean(pendingRequest)}
		>
			<AlertDialogContent size="sm">
				<AlertDialogHeader>
					<AlertDialogTitle>
						{t.units.relationshipManagement.requestConfirmationTitle}
					</AlertDialogTitle>
				</AlertDialogHeader>
				<AlertDialogBody className="grid gap-4">
					<AlertDialogDescription>
						{t.units.relationshipManagement.requestConfirmationDescription}
					</AlertDialogDescription>
					<RequestFailure error={request.error} fallback={t.ui.retryLater} />
				</AlertDialogBody>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={request.isPending} onClick={onCancel}>
						{t.units.relationshipManagement.cancel}
					</AlertDialogCancel>
					<AlertDialogAction isLoading={request.isPending} onClick={() => void confirm()}>
						{t.units.relationshipManagement.sendRequest}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function ProposalActions({
	onChanged,
	proposal,
	unitId,
}: {
	readonly onChanged: () => Promise<void>;
	readonly proposal: Proposal;
	readonly unitId: string;
}) {
	const { t } = useTranslation(["governance", "units"]);
	const accept = usePostApiUnitByUnitIdAssociationProposalsByProposalIdAccept();
	const decline = usePostApiUnitByUnitIdAssociationProposalsByProposalIdDecline();
	const cancel = useDeleteApiUnitByUnitIdAssociationProposalsByProposalId();
	const receivingInvitation = proposal.direction === "invitation";

	async function mutate(action: "accept" | "decline" | "cancel") {
		try {
			if (action === "accept")
				await accept.mutateAsync({ path: { unitId, proposalId: proposal.id }, body: {} });
			else if (action === "decline")
				await decline.mutateAsync({ path: { unitId, proposalId: proposal.id }, body: {} });
			else await cancel.mutateAsync({ path: { unitId, proposalId: proposal.id } });
			await onChanged();
		} catch {
			// The typed mutation state renders the localized API error below.
		}
	}

	const pending = accept.isPending || decline.isPending || cancel.isPending;
	return (
		<>
			{receivingInvitation ? (
				<>
					<Button
						disabled={pending}
						onClick={() => void mutate("accept")}
						size="sm"
						type="button"
						variant="solid"
					>
						{t.governance.accept}
					</Button>
					<Button
						disabled={pending}
						onClick={() => void mutate("decline")}
						size="sm"
						type="button"
						variant="outline"
					>
						{t.governance.decline}
					</Button>
				</>
			) : (
				<Button
					disabled={pending}
					onClick={() => void mutate("cancel")}
					size="sm"
					type="button"
					variant="outline"
				>
					{t.governance.cancel}
				</Button>
			)}
			<RequestFailure error={accept.error ?? decline.error ?? cancel.error} />
		</>
	);
}

function PendingProposalList({
	kind,
	query,
	refresh,
	unitId,
}: {
	readonly kind: AssociationKind;
	readonly query: ProposalQueryState;
	readonly refresh: () => Promise<void>;
	readonly unitId: string;
}) {
	const { t } = useTranslation(["governance", "ui", "units"]);
	const pending = query.data?.items.filter((proposal) => proposal.state === "pending") ?? [];
	const presentations = useResolvedUnitPresentations(
		pending.map((proposal) => proposal.targetUnitId),
	);
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (pending.length === 0) return null;

	return (
		<div className="border-t border-border-weak bg-muted/24">
			<div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
				<strong className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					{t.units.relationshipManagement.pendingRequests}
				</strong>
				<Badge size="sm" variant="outline">
					{pending.length}
				</Badge>
			</div>
			<div className="border-t border-border-weak bg-background">
				{pending.map((proposal) => {
					const presentation = presentations.get(proposal.targetUnitId);
					const role =
						kind === "credit" && isKnownAttributionRole(proposal.role)
							? t.units.attributionRoles[proposal.role]
							: kind === "subject" && isSubjectAssociationRole(proposal.role)
								? t.units.subjectAssociationRoles[proposal.role]
								: proposal.role;
					return (
						<RelationshipRow
							actions={
								<ProposalActions
									onChanged={refresh}
									proposal={proposal}
									unitId={unitId}
								/>
							}
							avatar={presentation?.avatar}
							description={
								<>
									<Badge size="sm" variant="outline">
										{role}
									</Badge>
									<span>{t.governance.direction[proposal.direction]}</span>
									<span>·</span>
									<span>{t.governance.states[proposal.state]}</span>
								</>
							}
							key={proposal.id}
							title={presentationFallback(
								presentation,
								t.units.relationshipManagement.unavailableUnit,
							)}
						/>
					);
				})}
			</div>
		</div>
	);
}

function CreditSection({
	onAdd,
	proposals,
	refreshProposals,
	type,
	unit,
}: {
	readonly onAdd: () => void;
	readonly proposals: ProposalQueryState;
	readonly refreshProposals: () => Promise<void>;
	readonly type: WorkUnitType;
	readonly unit: Unit;
}) {
	const { t } = useTranslation(["ui", "units"]);
	const queryClient = useQueryClient();
	const remove = useDeleteApiUnitsByTypeByUnitIdCreditAttributionsByAssociationId();

	return (
		<RelationshipSection
			action={
				<Button onClick={onAdd} size="sm" type="button" variant="outline">
					<Plus aria-hidden className="size-4" />
					{t.units.relationshipManagement.addCredit}
				</Button>
			}
			count={unit.attributions.length}
			description={t.units.relationshipManagement.creditsDescription}
			icon={UserRound}
			title={t.units.relationshipManagement.credits}
		>
			{unit.attributions.length ? (
				<div>
					{unit.attributions.map((attribution) => {
						const title = attribution.creditedUnit.title ?? t.ui.unnamed;
						return (
							<RelationshipRow
								actions={
									<RemoveRelationshipDialog
										description={t.units.relationshipManagement.removeCreditDescription(
											{
												name: title,
											},
										)}
										label={t.units.relationshipManagement.removeCreditLabel({
											name: title,
										})}
										onRemove={async () => {
											try {
												await remove.mutateAsync({
													path: {
														type,
														unitId: unit.id,
														associationId: attribution.id,
													},
												});
												await invalidateUnitDetail(
													queryClient,
													type,
													unit.id,
												);
												toast.create({
													title: t.units.relationshipManagement
														.creditRemoved,
													type: "success",
												});
											} catch {
												// The typed mutation state renders below.
											}
										}}
										pending={remove.isPending}
										title={t.units.relationshipManagement.removeCreditTitle}
									/>
								}
								avatar={attribution.creditedUnit.avatar}
								description={
									<Badge size="sm" variant="outline">
										{t.units.attributionRoles[attribution.role]}
									</Badge>
								}
								key={attribution.id}
								title={title}
							/>
						);
					})}
				</div>
			) : (
				<EmptyRelationshipState
					description={t.units.relationshipManagement.noCreditsDescription}
					title={t.units.relationshipManagement.noCredits}
				/>
			)}
			<PendingProposalList
				kind="credit"
				query={proposals}
				refresh={refreshProposals}
				unitId={unit.id}
			/>
			<RequestFailure error={remove.error} fallback={t.ui.retryLater} />
		</RelationshipSection>
	);
}

function SubjectSection({
	onAdd,
	proposals,
	refreshProposals,
	type,
	unit,
}: {
	readonly onAdd: () => void;
	readonly proposals: ProposalQueryState;
	readonly refreshProposals: () => Promise<void>;
	readonly type: WorkUnitType;
	readonly unit: Unit;
}) {
	const { t } = useTranslation(["ui", "units"]);
	const queryClient = useQueryClient();
	const remove = useDeleteApiUnitsByTypeByUnitIdSubjectAssociationsByAssociationId();

	return (
		<RelationshipSection
			action={
				<Button onClick={onAdd} size="sm" type="button" variant="outline">
					<Plus aria-hidden className="size-4" />
					{t.units.relationshipManagement.addSubject}
				</Button>
			}
			count={unit.subjectAssociations.length}
			description={t.units.relationshipManagement.subjectsDescription}
			icon={UsersRound}
			title={t.units.relationshipManagement.subjects}
		>
			{unit.subjectAssociations.length ? (
				<div>
					{unit.subjectAssociations.map((association) => {
						const title = association.title ?? t.ui.unnamed;
						return (
							<RelationshipRow
								actions={
									<RemoveRelationshipDialog
										description={t.units.relationshipManagement.removeSubjectDescription(
											{
												name: title,
											},
										)}
										label={t.units.relationshipManagement.removeSubjectLabel({
											name: title,
										})}
										onRemove={async () => {
											try {
												await remove.mutateAsync({
													path: {
														type,
														unitId: unit.id,
														associationId: association.id,
													},
												});
												await invalidateUnitDetail(
													queryClient,
													type,
													unit.id,
												);
												toast.create({
													title: t.units.relationshipManagement
														.subjectRemoved,
													type: "success",
												});
											} catch {
												// The typed mutation state renders below.
											}
										}}
										pending={remove.isPending}
										title={t.units.relationshipManagement.removeSubjectTitle}
									/>
								}
								description={
									<>
										<Badge size="sm" variant="outline">
											{t.units.subjectAssociationRoles[association.role]}
										</Badge>
										{association.contextPost?.title ? (
											<span>
												{t.units.relationshipManagement.contextPost({
													title: association.contextPost.title,
												})}
											</span>
										) : null}
									</>
								}
								key={association.id}
								title={title}
							/>
						);
					})}
				</div>
			) : (
				<EmptyRelationshipState
					description={t.units.relationshipManagement.noSubjectsDescription}
					title={t.units.relationshipManagement.noSubjects}
				/>
			)}
			<PendingProposalList
				kind="subject"
				query={proposals}
				refresh={refreshProposals}
				unitId={unit.id}
			/>
			<RequestFailure error={remove.error} fallback={t.ui.retryLater} />
		</RelationshipSection>
	);
}

function SourceLinksSection({
	onAdd,
	type,
	unit,
}: {
	readonly onAdd: () => void;
	readonly type: WorkUnitType;
	readonly unit: Unit;
}) {
	const { t } = useTranslation(["ui", "units"]);
	const queryClient = useQueryClient();
	const remove = useDeleteApiUnitsByTypeByUnitIdLinksByLinkId();
	const presentations = useResolvedUnitPresentations(
		unit.links.map((link) => link.sourceEntityId),
	);

	return (
		<RelationshipSection
			action={
				<Button onClick={onAdd} size="sm" type="button" variant="outline">
					<Plus aria-hidden className="size-4" />
					{t.units.relationshipManagement.addLink}
				</Button>
			}
			count={unit.links.length}
			description={t.units.relationshipManagement.linksDescription}
			icon={Link2}
			title={t.units.relationshipManagement.links}
		>
			{unit.links.length ? (
				<div>
					{unit.links.map((link) => {
						const presentation = presentations.get(link.sourceEntityId);
						const title = presentationFallback(
							presentation,
							t.units.relationshipManagement.unavailableUnit,
						);
						return (
							<RelationshipRow
								actions={
									<>
										<Button
											aria-label={t.units.relationshipManagement.openLinkLabel(
												{
													name: title,
												},
											)}
											asChild
											size="icon-md"
											variant="quiet"
										>
											<a href={link.url} rel="noreferrer" target="_blank">
												<ExternalLink aria-hidden className="size-4" />
											</a>
										</Button>
										<RemoveRelationshipDialog
											description={t.units.relationshipManagement.removeLinkDescription(
												{
													name: title,
												},
											)}
											label={t.units.relationshipManagement.removeLinkLabel({
												name: title,
											})}
											onRemove={async () => {
												try {
													await remove.mutateAsync({
														path: {
															type,
															unitId: unit.id,
															linkId: link.id,
														},
													});
													await invalidateUnitDetail(
														queryClient,
														type,
														unit.id,
													);
													toast.create({
														title: t.units.relationshipManagement
															.linkRemoved,
														type: "success",
													});
												} catch {
													// The typed mutation state renders below.
												}
											}}
											pending={remove.isPending}
											title={t.units.relationshipManagement.removeLinkTitle}
										/>
									</>
								}
								avatar={presentation?.avatar}
								description={
									<span className="max-w-full truncate" title={link.url}>
										{link.url}
									</span>
								}
								key={link.id}
								title={title}
							/>
						);
					})}
				</div>
			) : (
				<EmptyRelationshipState
					description={t.units.relationshipManagement.noLinksDescription}
					title={t.units.relationshipManagement.noLinks}
				/>
			)}
			<RequestFailure error={remove.error} fallback={t.ui.retryLater} />
		</RelationshipSection>
	);
}

function MainUnitDialog({
	currentMainUnitId,
	open,
	onOpenChange,
	type,
	unitId,
}: {
	readonly currentMainUnitId: string | null;
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
	readonly type: VariantUnitType;
	readonly unitId: string;
}) {
	const { t } = useTranslation(["ui", "units"]);
	const queryClient = useQueryClient();
	const [mainUnitId, setMainUnitId] = useState<string>();
	const update = usePatchApiUnitsByTypeByUnitIdVariantContext();

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!mainUnitId || mainUnitId === unitId || update.isPending) return;
		try {
			await update.mutateAsync({
				path: { type, unitId },
				body: { mainUnitId, expectedMainUnitId: currentMainUnitId },
			});
			await invalidateUnitDetail(queryClient, type, unitId);
			setMainUnitId(undefined);
			onOpenChange(false);
			toast.create({
				title: t.units.relationshipManagement.mainUpdated,
				type: "success",
			});
		} catch {
			// The typed mutation state renders the localized API error below.
		}
	}

	return (
		<Dialog
			onOpenChange={({ open: nextOpen }) => {
				if (!update.isPending) onOpenChange(nextOpen);
			}}
			open={open}
		>
			<DialogContent showCloseButton={false} size="sm">
				<DialogHeader
					description={t.units.relationshipManagement.changeMainDescription}
					title={t.units.relationshipManagement.changeMain}
				/>
				<form
					className="flex min-h-0 flex-1 flex-col"
					onSubmit={(event) => void submit(event)}
				>
					<DialogBody className="grid gap-4">
						<Field required>
							<FieldLabel>{t.units.relationshipManagement.mainUnit}</FieldLabel>
							<UnitPicker
								ariaLabel={t.units.relationshipManagement.mainUnit}
								kinds={[type]}
								onValueChange={setMainUnitId}
								placeholder={t.ui.pickerPlaceholders.unit}
								value={mainUnitId}
							/>
						</Field>
						<RequestFailure error={update.error} fallback={t.ui.retryLater} />
					</DialogBody>
					<DialogFooter>
						<Button
							disabled={update.isPending}
							onClick={() => onOpenChange(false)}
							type="button"
							variant="outline"
						>
							{t.units.relationshipManagement.cancel}
						</Button>
						<Button
							disabled={!mainUnitId || mainUnitId === unitId}
							isLoading={update.isPending}
							type="submit"
						>
							{t.units.relationshipManagement.saveMain}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function VariantSection({
	onChangeMain,
	type,
	unit,
}: {
	readonly onChangeMain: () => void;
	readonly type: VariantUnitType;
	readonly unit: Unit;
}) {
	const { t } = useTranslation(["ui", "units"]);
	const queryClient = useQueryClient();
	const update = usePatchApiUnitsByTypeByUnitIdVariantContext();
	const promote = usePostApiUnitsByTypeByUnitIdVariantContextPromote();
	const context = unit.variantContext;
	const availableMainUnit =
		context.role === "variant" && context.main.state === "available" ? context.main.unit : null;
	const count =
		context.role === "main"
			? context.variants.length
			: context.role === "variant" && context.main.state === "available"
				? 1
				: 0;
	const action =
		context.role === "standalone" ||
		(context.role === "variant" && context.main.state === "available") ? (
			<Button onClick={onChangeMain} size="sm" type="button" variant="outline">
				<GitBranch aria-hidden className="size-4" />
				{context.role === "standalone"
					? t.units.relationshipManagement.attachMain
					: t.units.relationshipManagement.changeMain}
			</Button>
		) : undefined;

	return (
		<RelationshipSection
			action={action}
			count={count}
			description={t.units.relationshipManagement.variantsDescription}
			icon={GitBranch}
			title={t.units.relationshipManagement.variants}
		>
			{context.role === "standalone" ? (
				<EmptyRelationshipState
					description={t.units.relationshipManagement.standaloneDescription}
					title={t.units.relationshipManagement.standalone}
				/>
			) : context.role === "variant" ? (
				availableMainUnit ? (
					<>
						<RelationshipRow
							actions={
								<RemoveRelationshipDialog
									description={
										t.units.relationshipManagement.detachMainDescription
									}
									label={t.units.relationshipManagement.detachMain}
									onRemove={async () => {
										try {
											await update.mutateAsync({
												path: { type, unitId: unit.id },
												body: {
													mainUnitId: null,
													expectedMainUnitId: availableMainUnit.id,
												},
											});
											await invalidateUnitDetail(queryClient, type, unit.id);
											toast.create({
												title: t.units.relationshipManagement.mainDetached,
												type: "success",
											});
										} catch {
											// The typed mutation state renders below.
										}
									}}
									pending={update.isPending}
									title={t.units.relationshipManagement.detachMainTitle}
								/>
							}
							description={
								<Badge size="sm" variant="outline">
									{t.units.relationshipManagement.main}
								</Badge>
							}
							title={availableMainUnit.title ?? t.ui.unnamed}
						/>
						<RequestFailure error={update.error} fallback={t.ui.retryLater} />
					</>
				) : (
					<EmptyRelationshipState
						description={t.units.relationshipManagement.mainUnavailableDescription}
						title={t.units.relationshipManagement.mainUnavailable}
					/>
				)
			) : context.variants.length ? (
				<div>
					{context.variants.map((variant) => (
						<RelationshipRow
							actions={
								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button
											aria-label={t.units.relationshipManagement.promoteLabel(
												{
													name: variant.title ?? t.ui.unnamed,
												},
											)}
											size="icon-md"
											type="button"
											variant="quiet"
										>
											<ArrowUpRight aria-hidden className="size-4" />
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent size="sm">
										<AlertDialogHeader>
											<AlertDialogTitle>
												{t.units.relationshipManagement.promoteTitle}
											</AlertDialogTitle>
										</AlertDialogHeader>
										<AlertDialogBody>
											<AlertDialogDescription>
												{t.units.relationshipManagement.promoteDescription({
													name: variant.title ?? t.ui.unnamed,
												})}
											</AlertDialogDescription>
										</AlertDialogBody>
										<AlertDialogFooter>
											<AlertDialogCancel disabled={promote.isPending}>
												{t.units.relationshipManagement.cancel}
											</AlertDialogCancel>
											<AlertDialogAction
												isLoading={promote.isPending}
												onClick={async () => {
													try {
														await promote.mutateAsync({
															path: { type, unitId: variant.id },
															body: { expectedMainUnitId: unit.id },
														});
														await invalidateUnitDetail(
															queryClient,
															type,
															unit.id,
														);
														toast.create({
															title: t.units.relationshipManagement
																.promoted,
															type: "success",
														});
													} catch {
														// The typed mutation state renders below.
													}
												}}
											>
												{t.units.relationshipManagement.promote}
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							}
							description={
								<Badge size="sm" variant="outline">
									{t.units.relationshipManagement.variant}
								</Badge>
							}
							key={variant.id}
							title={variant.title ?? t.ui.unnamed}
						/>
					))}
					<RequestFailure error={promote.error} fallback={t.ui.retryLater} />
				</div>
			) : (
				<EmptyRelationshipState
					description={t.units.relationshipManagement.noVariantsDescription}
					title={t.units.relationshipManagement.noVariants}
				/>
			)}
		</RelationshipSection>
	);
}

export function UnitRelationshipManager({
	type,
	unit,
}: {
	readonly type: WorkUnitType;
	readonly unit: Unit;
}) {
	const queryClient = useQueryClient();
	const [creditOpen, setCreditOpen] = useState(false);
	const [subjectOpen, setSubjectOpen] = useState(false);
	const [linkOpen, setLinkOpen] = useState(false);
	const [mainOpen, setMainOpen] = useState(false);
	const [pendingRequest, setPendingRequest] = useState<PendingAssociationRequest>();
	const creditQueryOptions = {
		path: { unitId: unit.id },
		query: { side: "source", kind: "credit", includeResolved: false },
	} as const;
	const subjectQueryOptions = {
		path: { unitId: unit.id },
		query: { side: "source", kind: "subject", includeResolved: false },
	} as const;
	const creditProposals = useGetApiUnitByUnitIdAssociationProposals(creditQueryOptions);
	const subjectProposals = useGetApiUnitByUnitIdAssociationProposals(subjectQueryOptions);
	const refreshProposal = async (kind: AssociationKind) => {
		const options = kind === "credit" ? creditQueryOptions : subjectQueryOptions;
		await queryClient.invalidateQueries({
			queryKey: getApiUnitByUnitIdAssociationProposalsQueryKey(options),
		});
	};
	const variantContext =
		isVariantUnitType(type) && unit.variantContext.role !== "main"
			? unit.variantContext.role === "variant" &&
				unit.variantContext.main.state === "available"
				? unit.variantContext.main.unit.id
				: null
			: null;

	return (
		<div className="grid gap-5">
			<CreditSection
				onAdd={() => setCreditOpen(true)}
				proposals={creditProposals}
				refreshProposals={() => refreshProposal("credit")}
				type={type}
				unit={unit}
			/>
			<SubjectSection
				onAdd={() => setSubjectOpen(true)}
				proposals={subjectProposals}
				refreshProposals={() => refreshProposal("subject")}
				type={type}
				unit={unit}
			/>
			<SourceLinksSection onAdd={() => setLinkOpen(true)} type={type} unit={unit} />
			{isVariantUnitType(type) ? (
				<VariantSection onChangeMain={() => setMainOpen(true)} type={type} unit={unit} />
			) : null}

			<AddCreditDialog
				onOpenChange={setCreditOpen}
				onRestricted={setPendingRequest}
				open={creditOpen}
				type={type}
				unitId={unit.id}
			/>
			<AddSubjectDialog
				onOpenChange={setSubjectOpen}
				onRestricted={setPendingRequest}
				open={subjectOpen}
				type={type}
				unitId={unit.id}
			/>
			<AddSourceLinkDialog
				onOpenChange={setLinkOpen}
				open={linkOpen}
				type={type}
				unitId={unit.id}
			/>
			{isVariantUnitType(type) ? (
				<MainUnitDialog
					currentMainUnitId={variantContext}
					onOpenChange={setMainOpen}
					open={mainOpen}
					type={type}
					unitId={unit.id}
				/>
			) : null}
			<AssociationRequestConfirmation
				onCancel={() => setPendingRequest(undefined)}
				onRequested={async (kind) => {
					await refreshProposal(kind);
					if (kind === "credit") setCreditOpen(false);
					else setSubjectOpen(false);
				}}
				pendingRequest={pendingRequest}
				unitId={unit.id}
			/>
		</div>
	);
}
