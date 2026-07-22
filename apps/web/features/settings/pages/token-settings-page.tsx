"use client";

import {
	getApiApiTokensQueryKey,
	PostApiApiTokensRequestPermissionsEnum,
	type GetApiApiTokensStatus200,
	useDeleteApiApiTokensByTokenId,
	useGetApiApiTokens,
	usePatchApiApiTokensByTokenId,
	usePostApiApiTokens,
	usePutApiApiTokensByTokenIdPolicy,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import {
	Alert,
	AlertDescription,
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
	AlertTitle,
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Checkbox,
	Clipboard,
	ClipboardIndicator,
	ClipboardInput,
	ClipboardTrigger,
	Field,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
	Input,
	ManagementWorkspaceSectionHeader,
	NativeSelect,
	NativeSelectOption,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { RequestFailure } from "@/i18n/request-failure";
import { useTranslation } from "@/i18n/client";
import { SettingsOverviewHref } from "../routing/settings-routes";

type TokenRecord = GetApiApiTokensStatus200["items"][number];
type ApiTokenPermission =
	(typeof PostApiApiTokensRequestPermissionsEnum)[keyof typeof PostApiApiTokensRequestPermissionsEnum];
type PermissionLabel =
	| "unitRead"
	| "unitCreate"
	| "unitUpdate"
	| "unitDelete"
	| "profileRead"
	| "profileUpdate"
	| "interactionRead"
	| "interactionWrite"
	| "realmRead"
	| "realmManage"
	| "messageRead"
	| "messageWrite"
	| "notificationRead"
	| "notificationWrite"
	| "recommendationRead"
	| "recommendationWrite"
	| "uploadRead"
	| "uploadWrite"
	| "feedbackWrite";

const PermissionDefinitions = [
	{ value: "unit:read", label: "unitRead" },
	{ value: "unit:create", label: "unitCreate" },
	{ value: "unit:update", label: "unitUpdate" },
	{ value: "unit:delete", label: "unitDelete" },
	{ value: "profile:read", label: "profileRead" },
	{ value: "profile:update", label: "profileUpdate" },
	{ value: "interaction:read", label: "interactionRead" },
	{ value: "interaction:write", label: "interactionWrite" },
	{ value: "realm:read", label: "realmRead" },
	{ value: "realm:manage", label: "realmManage" },
	{ value: "message:read", label: "messageRead" },
	{ value: "message:write", label: "messageWrite" },
	{ value: "notification:read", label: "notificationRead" },
	{ value: "notification:write", label: "notificationWrite" },
	{ value: "recommendation:read", label: "recommendationRead" },
	{ value: "recommendation:write", label: "recommendationWrite" },
	{ value: "upload:read", label: "uploadRead" },
	{ value: "upload:write", label: "uploadWrite" },
	{ value: "feedback:write", label: "feedbackWrite" },
] as const satisfies readonly { value: ApiTokenPermission; label: PermissionLabel }[];

const ReadOnlyPermissions = [
	"unit:read",
	"profile:read",
	"interaction:read",
	"realm:read",
	"message:read",
	"notification:read",
	"recommendation:read",
	"upload:read",
] as const satisfies readonly ApiTokenPermission[];

const ContentAgentPermissions = [
	"unit:read",
	"unit:create",
	"unit:update",
	"profile:read",
	"upload:read",
	"upload:write",
] as const satisfies readonly ApiTokenPermission[];

function formatDate(value: string, locale: string) {
	return new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function togglePermission(
	current: readonly ApiTokenPermission[],
	permission: ApiTokenPermission,
	checked: boolean,
): ApiTokenPermission[] {
	if (checked) return current.includes(permission) ? [...current] : [...current, permission];
	return current.filter((candidate) => candidate !== permission);
}

function PermissionFields({
	selected,
	onChange,
}: {
	selected: readonly ApiTokenPermission[];
	onChange: (permissions: ApiTokenPermission[]) => void;
}) {
	const { t } = useTranslation(["settings"]);
	return (
		<div className="grid gap-2 sm:grid-cols-2">
			{PermissionDefinitions.map(({ value, label }) => (
				<Field key={value} orientation="horizontal">
					<Checkbox
						checked={selected.includes(value)}
						onCheckedChange={({ checked }) =>
							onChange(togglePermission(selected, value, checked === true))
						}
					/>
					<FieldLabel className="font-normal">
						{t.settings.tokens.permissionLabels[label]}
					</FieldLabel>
				</Field>
			))}
		</div>
	);
}

function GlobalLimitFields({ defaults }: { defaults?: TokenRecord["policy"]["limits"] }) {
	const { t } = useTranslation(["settings"]);
	return (
		<div className="grid gap-4 sm:grid-cols-3">
			<Field required>
				<FieldLabel>{t.settings.tokens.requestsPerMinute}</FieldLabel>
				<Input
					defaultValue={Number(defaults?.requestsPerMinute ?? 60)}
					max={300}
					min={1}
					name="requestsPerMinute"
					required
					type="number"
				/>
			</Field>
			<Field required>
				<FieldLabel>{t.settings.tokens.maxConcurrentRequests}</FieldLabel>
				<Input
					defaultValue={Number(defaults?.maxConcurrentRequests ?? 2)}
					max={4}
					min={1}
					name="maxConcurrentRequests"
					required
					type="number"
				/>
			</Field>
			<Field required>
				<FieldLabel>{t.settings.tokens.dailyCostUnits}</FieldLabel>
				<Input
					defaultValue={Number(defaults?.dailyCostUnits ?? 2_000)}
					max={10_000}
					min={1}
					name="dailyCostUnits"
					required
					type="number"
				/>
			</Field>
		</div>
	);
}

function CreateTokenCard({ refresh }: { refresh: () => Promise<unknown> }) {
	const { t } = useTranslation(["settings", "ui"]);
	const [permissions, setPermissions] = useState<ApiTokenPermission[]>([
		...ContentAgentPermissions,
	]);
	const [permissionsInvalid, setPermissionsInvalid] = useState(false);
	const [secret, setSecret] = useState<string>();
	const create = usePostApiApiTokens<unknown>({
		mutation: {
			onSuccess: async (token) => {
				setSecret(token.token);
				await refresh();
			},
		},
	});

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setPermissionsInvalid(permissions.length === 0);
		if (permissions.length === 0) return;
		const form = new FormData(event.currentTarget);
		await create.mutateAsync({
			body: {
				name: String(form.get("name") ?? "").trim(),
				expiresInDays: Number(form.get("expiresInDays")),
				permissions,
				policyOverride: {
					limits: {
						requestsPerMinute: Number(form.get("requestsPerMinute")),
						maxConcurrentRequests: Number(form.get("maxConcurrentRequests")),
						dailyCostUnits: Number(form.get("dailyCostUnits")),
					},
				},
			},
		});
	}

	return (
		<Card appearance="outlined">
			<CardHeader>
				<CardTitle>{t.settings.tokens.createTitle}</CardTitle>
				<CardDescription>{t.settings.tokens.createDescription}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-6">
				{secret ? (
					<Alert variant="warning">
						<KeyRound />
						<AlertTitle>{t.settings.tokens.createdTitle}</AlertTitle>
						<AlertDescription>
							<p>{t.settings.tokens.createdDescription}</p>
							<Clipboard className="w-full" value={secret}>
								<ClipboardInput
									aria-label={t.settings.tokens.createdTitle}
									className="min-w-0 flex-1 font-mono"
									readOnly
								/>
								<ClipboardTrigger asChild>
									<Button type="button" variant="outline">
										<ClipboardIndicator />
										{t.settings.tokens.copyToken}
									</Button>
								</ClipboardTrigger>
							</Clipboard>
							<Button
								onClick={() => {
									setSecret(undefined);
									create.reset();
								}}
								type="button"
								variant="outline"
							>
								{t.settings.tokens.dismissSecret}
							</Button>
						</AlertDescription>
					</Alert>
				) : null}
				<form className="grid gap-6" onSubmit={submit}>
					<FieldGroup>
						<Field required>
							<FieldLabel>{t.settings.tokens.name}</FieldLabel>
							<Input
								maxLength={120}
								name="name"
								placeholder={t.settings.tokens.namePlaceholder}
								required
							/>
						</Field>
						<Field required>
							<FieldLabel>{t.settings.tokens.expiresIn}</FieldLabel>
							<NativeSelect defaultValue="90" name="expiresInDays">
								<NativeSelectOption value="30">
									{t.settings.tokens.expiryDays.thirty}
								</NativeSelectOption>
								<NativeSelectOption value="90">
									{t.settings.tokens.expiryDays.ninety}
								</NativeSelectOption>
								<NativeSelectOption value="365">
									{t.settings.tokens.expiryDays.year}
								</NativeSelectOption>
							</NativeSelect>
						</Field>
						<FieldSet>
							<FieldLegend variant="label">
								{t.settings.tokens.permissions}
							</FieldLegend>
							<p className="text-sm text-muted-foreground">
								{t.settings.tokens.permissionsDescription}
							</p>
							<div className="flex flex-wrap gap-2">
								<Button
									onClick={() => setPermissions([...ContentAgentPermissions])}
									size="sm"
									type="button"
									variant="outline"
								>
									{t.settings.tokens.selectContentAgent}
								</Button>
								<Button
									onClick={() => setPermissions([...ReadOnlyPermissions])}
									size="sm"
									type="button"
									variant="outline"
								>
									{t.settings.tokens.selectReadOnly}
								</Button>
							</div>
							<PermissionFields selected={permissions} onChange={setPermissions} />
							{permissionsInvalid ? (
								<p className="text-sm text-destructive" role="alert">
									{t.settings.tokens.permissionsRequired}
								</p>
							) : null}
						</FieldSet>
						<FieldSet>
							<FieldLegend variant="label">{t.settings.tokens.limits}</FieldLegend>
							<p className="text-sm text-muted-foreground">
								{t.settings.tokens.limitsDescription}
							</p>
							<GlobalLimitFields />
						</FieldSet>
						<RequestFailure error={create.error} fallback={t.ui.retryLater} />
						<Button isLoading={create.isPending} type="submit" variant="solid">
							{t.settings.tokens.create}
						</Button>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}

function TokenAccessEditor({
	token,
	refresh,
}: {
	token: TokenRecord;
	refresh: () => Promise<unknown>;
}) {
	const { t } = useTranslation(["settings", "ui"]);
	const [permissions, setPermissions] = useState<ApiTokenPermission[]>([
		...(token.permissions as ApiTokenPermission[]),
	]);
	const [invalid, setInvalid] = useState(false);
	const update = usePatchApiApiTokensByTokenId<unknown>({
		mutation: { onSuccess: refresh },
	});

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setInvalid(permissions.length === 0);
		if (permissions.length === 0) return;
		const form = new FormData(event.currentTarget);
		await update.mutateAsync({
			path: { tokenId: token.id },
			body: { name: String(form.get("name") ?? "").trim(), permissions },
		});
	}

	return (
		<form className="grid gap-4 rounded-lg border border-border-weak p-4" onSubmit={submit}>
			<Field required>
				<FieldLabel>{t.settings.tokens.name}</FieldLabel>
				<Input defaultValue={token.name} maxLength={120} name="name" required />
			</Field>
			<FieldSet>
				<FieldLegend variant="label">{t.settings.tokens.permissions}</FieldLegend>
				<PermissionFields selected={permissions} onChange={setPermissions} />
				{invalid ? (
					<p className="text-sm text-destructive" role="alert">
						{t.settings.tokens.permissionsRequired}
					</p>
				) : null}
			</FieldSet>
			<RequestFailure error={update.error} fallback={t.ui.retryLater} />
			<Button isLoading={update.isPending} type="submit" variant="solid">
				{t.settings.tokens.saveAccess}
			</Button>
		</form>
	);
}

type OperationLimitRow = {
	key: string;
	operationId: string;
	requestsPerMinute: number;
	maxConcurrentRequests: number;
	dailyCostUnits: number;
};

function TokenPolicyEditor({
	token,
	refresh,
}: {
	token: TokenRecord;
	refresh: () => Promise<unknown>;
}) {
	const { t } = useTranslation(["settings", "ui"]);
	const trusted = token.policy.kind === "staff_trusted";
	const maximums = trusted
		? { requestsPerMinute: 5_000, maxConcurrentRequests: 64, dailyCostUnits: 1_000_000 }
		: { requestsPerMinute: 300, maxConcurrentRequests: 4, dailyCostUnits: 10_000 };
	const [requestsPerMinute, setRequestsPerMinute] = useState(
		Number(token.policy.limits.requestsPerMinute),
	);
	const [maxConcurrentRequests, setMaxConcurrentRequests] = useState(
		Number(token.policy.limits.maxConcurrentRequests),
	);
	const [dailyCostUnits, setDailyCostUnits] = useState(
		Number(token.policy.limits.dailyCostUnits),
	);
	const [operations, setOperations] = useState<OperationLimitRow[]>(() =>
		Object.entries(token.policy.operations).map(([operationId, limits], index) => ({
			key: `stored-${index}-${operationId}`,
			operationId,
			requestsPerMinute: Number(limits.requestsPerMinute ?? requestsPerMinute),
			maxConcurrentRequests: Number(limits.maxConcurrentRequests ?? maxConcurrentRequests),
			dailyCostUnits: Number(limits.dailyCostUnits ?? dailyCostUnits),
		})),
	);
	const [invalid, setInvalid] = useState(false);
	const replace = usePutApiApiTokensByTokenIdPolicy<unknown>({
		mutation: { onSuccess: refresh },
	});

	function updateOperation(key: string, patch: Partial<OperationLimitRow>) {
		setOperations((current) =>
			current.map((operation) =>
				operation.key === key ? { ...operation, ...patch } : operation,
			),
		);
	}

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const operationIds = operations.map(({ operationId }) => operationId.trim());
		const valid =
			Number.isInteger(requestsPerMinute) &&
			requestsPerMinute >= 1 &&
			requestsPerMinute <= maximums.requestsPerMinute &&
			Number.isInteger(maxConcurrentRequests) &&
			maxConcurrentRequests >= 1 &&
			maxConcurrentRequests <= maximums.maxConcurrentRequests &&
			Number.isInteger(dailyCostUnits) &&
			dailyCostUnits >= 1 &&
			dailyCostUnits <= maximums.dailyCostUnits &&
			new Set(operationIds).size === operationIds.length &&
			operations.every(
				(operation) =>
					/^[A-Za-z][A-Za-z0-9_-]*$/.test(operation.operationId.trim()) &&
					Number.isInteger(operation.requestsPerMinute) &&
					operation.requestsPerMinute >= 1 &&
					operation.requestsPerMinute <= maximums.requestsPerMinute &&
					Number.isInteger(operation.maxConcurrentRequests) &&
					operation.maxConcurrentRequests >= 1 &&
					operation.maxConcurrentRequests <= maximums.maxConcurrentRequests &&
					Number.isInteger(operation.dailyCostUnits) &&
					operation.dailyCostUnits >= 1 &&
					operation.dailyCostUnits <= maximums.dailyCostUnits,
			);
		setInvalid(!valid);
		if (!valid) return;
		await replace.mutateAsync({
			path: { tokenId: token.id },
			body: {
				expectedRevision: Number(token.policy.bindingRevision ?? 1),
				configurationOverride: {
					limits: { requestsPerMinute, maxConcurrentRequests, dailyCostUnits },
					operations: Object.fromEntries(
						operations.map((operation) => [
							operation.operationId.trim(),
							{
								requestsPerMinute: operation.requestsPerMinute,
								maxConcurrentRequests: operation.maxConcurrentRequests,
								dailyCostUnits: operation.dailyCostUnits,
							},
						]),
					),
				},
			},
		});
	}

	return (
		<form className="grid gap-5 rounded-lg border border-border-weak p-4" onSubmit={submit}>
			<FieldSet>
				<FieldLegend variant="label">{t.settings.tokens.limits}</FieldLegend>
				<div className="grid gap-4 sm:grid-cols-3">
					<Field required>
						<FieldLabel>{t.settings.tokens.requestsPerMinute}</FieldLabel>
						<Input
							max={maximums.requestsPerMinute}
							min={1}
							onChange={(event) =>
								setRequestsPerMinute(event.currentTarget.valueAsNumber)
							}
							required
							type="number"
							value={requestsPerMinute}
						/>
					</Field>
					<Field required>
						<FieldLabel>{t.settings.tokens.maxConcurrentRequests}</FieldLabel>
						<Input
							max={maximums.maxConcurrentRequests}
							min={1}
							onChange={(event) =>
								setMaxConcurrentRequests(event.currentTarget.valueAsNumber)
							}
							required
							type="number"
							value={maxConcurrentRequests}
						/>
					</Field>
					<Field required>
						<FieldLabel>{t.settings.tokens.dailyCostUnits}</FieldLabel>
						<Input
							max={maximums.dailyCostUnits}
							min={1}
							onChange={(event) =>
								setDailyCostUnits(event.currentTarget.valueAsNumber)
							}
							required
							type="number"
							value={dailyCostUnits}
						/>
					</Field>
				</div>
			</FieldSet>
			<FieldSet>
				<FieldLegend variant="label">{t.settings.tokens.operationOverrides}</FieldLegend>
				<p className="text-sm text-muted-foreground">
					{t.settings.tokens.operationOverridesDescription}
				</p>
				<div className="grid gap-3">
					{operations.map((operation) => (
						<div
							className="grid gap-3 rounded-lg bg-muted/35 p-3 lg:grid-cols-[minmax(12rem,2fr)_repeat(3,minmax(7rem,1fr))_auto]"
							key={operation.key}
						>
							<Field required>
								<FieldLabel>{t.settings.tokens.operationId}</FieldLabel>
								<Input
									onChange={(event) =>
										updateOperation(operation.key, {
											operationId: event.currentTarget.value,
										})
									}
									placeholder={t.settings.tokens.operationIdPlaceholder}
									required
									value={operation.operationId}
								/>
							</Field>
							<Field required>
								<FieldLabel>{t.settings.tokens.requestsPerMinute}</FieldLabel>
								<Input
									max={maximums.requestsPerMinute}
									min={1}
									onChange={(event) =>
										updateOperation(operation.key, {
											requestsPerMinute: event.currentTarget.valueAsNumber,
										})
									}
									required
									type="number"
									value={operation.requestsPerMinute}
								/>
							</Field>
							<Field required>
								<FieldLabel>{t.settings.tokens.maxConcurrentRequests}</FieldLabel>
								<Input
									max={maximums.maxConcurrentRequests}
									min={1}
									onChange={(event) =>
										updateOperation(operation.key, {
											maxConcurrentRequests:
												event.currentTarget.valueAsNumber,
										})
									}
									required
									type="number"
									value={operation.maxConcurrentRequests}
								/>
							</Field>
							<Field required>
								<FieldLabel>{t.settings.tokens.dailyCostUnits}</FieldLabel>
								<Input
									max={maximums.dailyCostUnits}
									min={1}
									onChange={(event) =>
										updateOperation(operation.key, {
											dailyCostUnits: event.currentTarget.valueAsNumber,
										})
									}
									required
									type="number"
									value={operation.dailyCostUnits}
								/>
							</Field>
							<Button
								aria-label={t.settings.tokens.removeOperation}
								onClick={() =>
									setOperations((current) =>
										current.filter(
											(candidate) => candidate.key !== operation.key,
										),
									)
								}
								size="sm"
								type="button"
								variant="quiet"
							>
								<Trash2 />
							</Button>
						</div>
					))}
				</div>
				<Button
					onClick={() =>
						setOperations((current) => [
							...current,
							{
								key: `new-${crypto.randomUUID()}`,
								operationId: "",
								requestsPerMinute: Math.min(requestsPerMinute, 30),
								maxConcurrentRequests: 1,
								dailyCostUnits: Math.min(dailyCostUnits, 1_000),
							},
						])
					}
					size="sm"
					type="button"
					variant="outline"
				>
					<Plus />
					{t.settings.tokens.addOperation}
				</Button>
			</FieldSet>
			{invalid ? (
				<p className="text-sm text-destructive" role="alert">
					{t.settings.tokens.invalidLimits}
				</p>
			) : null}
			<RequestFailure error={replace.error} fallback={t.ui.retryLater} />
			<Button isLoading={replace.isPending} type="submit" variant="solid">
				{t.settings.tokens.saveLimits}
			</Button>
		</form>
	);
}

function TokenCard({
	token,
	refresh,
	locale,
}: {
	token: TokenRecord;
	refresh: () => Promise<unknown>;
	locale: string;
}) {
	const { t } = useTranslation(["settings", "ui"]);
	const [editor, setEditor] = useState<"access" | "policy">();
	const update = usePatchApiApiTokensByTokenId<unknown>({
		mutation: { onSuccess: refresh },
	});
	const revoke = useDeleteApiApiTokensByTokenId<unknown>({
		mutation: { onSuccess: refresh },
	});
	const policyLabel =
		token.policy.source === "trusted_fallback"
			? t.settings.tokens.trustedFallback
			: token.policy.kind === "staff_trusted"
				? t.settings.tokens.staffTrustedPolicy
				: t.settings.tokens.standardPolicy;

	return (
		<Card appearance="outlined">
			<CardHeader>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-0">
						<CardTitle className="break-words">{token.name}</CardTitle>
						<CardDescription className="mt-1 font-mono">
							{token.tokenPrefix}
						</CardDescription>
					</div>
					<div className="flex flex-wrap gap-2">
						<Badge variant={token.enabled ? "success" : "secondary"}>
							{token.enabled ? t.settings.tokens.enabled : t.settings.tokens.disabled}
						</Badge>
						<Badge
							variant={token.policy.kind === "staff_trusted" ? "warning" : "outline"}
						>
							{policyLabel}
						</Badge>
					</div>
				</div>
			</CardHeader>
			<CardContent className="grid gap-5">
				<dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
					<div>
						<dt className="text-muted-foreground">{t.settings.tokens.expires}</dt>
						<dd>{token.expiresAt ? formatDate(token.expiresAt, locale) : "—"}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">{t.settings.tokens.lastUsed}</dt>
						<dd>
							{token.lastUsedAt
								? formatDate(token.lastUsedAt, locale)
								: t.settings.tokens.neverUsed}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">
							{t.settings.tokens.requestsPerMinute}
						</dt>
						<dd>
							{Number(token.policy.limits.requestsPerMinute).toLocaleString(locale)}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">
							{t.settings.tokens.maxConcurrentRequests}
						</dt>
						<dd>
							{Number(token.policy.limits.maxConcurrentRequests).toLocaleString(
								locale,
							)}
						</dd>
					</div>
				</dl>
				{token.policy.kind === "staff_trusted" && token.policy.validUntil ? (
					<p className="text-sm text-warning">
						{t.settings.tokens.trustedUntil}:{" "}
						{formatDate(token.policy.validUntil, locale)}
					</p>
				) : null}
				<div className="flex flex-wrap gap-2">
					<Button
						onClick={() =>
							setEditor((current) => (current === "access" ? undefined : "access"))
						}
						size="sm"
						type="button"
						variant="outline"
					>
						{editor === "access"
							? t.settings.tokens.hideEditor
							: t.settings.tokens.manageAccess}
					</Button>
					<Button
						onClick={() =>
							setEditor((current) => (current === "policy" ? undefined : "policy"))
						}
						size="sm"
						type="button"
						variant="outline"
					>
						{editor === "policy"
							? t.settings.tokens.hideEditor
							: t.settings.tokens.configureLimits}
					</Button>
					<Button
						isLoading={update.isPending}
						onClick={() =>
							void update.mutateAsync({
								path: { tokenId: token.id },
								body: { enabled: !token.enabled },
							})
						}
						size="sm"
						type="button"
						variant="outline"
					>
						{token.enabled ? t.settings.tokens.disable : t.settings.tokens.enable}
					</Button>
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button size="sm" type="button" variant="destructive">
								{t.settings.tokens.revoke}
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>{t.settings.tokens.revokeTitle}</AlertDialogTitle>
							</AlertDialogHeader>
							<AlertDialogBody>
								<AlertDialogDescription>
									{t.settings.tokens.revokeDescription}
								</AlertDialogDescription>
							</AlertDialogBody>
							<AlertDialogFooter>
								<AlertDialogCancel>{t.settings.tokens.cancel}</AlertDialogCancel>
								<AlertDialogAction
									onClick={() =>
										void revoke.mutateAsync({ path: { tokenId: token.id } })
									}
									variant="destructive"
								>
									{t.settings.tokens.revoke}
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
				<RequestFailure error={update.error ?? revoke.error} fallback={t.ui.retryLater} />
				{editor === "access" ? (
					<TokenAccessEditor key={token.updatedAt} token={token} refresh={refresh} />
				) : null}
				{editor === "policy" ? (
					<TokenPolicyEditor
						key={`${token.policy.policyRevision}:${token.policy.bindingRevision}`}
						token={token}
						refresh={refresh}
					/>
				) : null}
			</CardContent>
		</Card>
	);
}

export function TokenSettingsPage() {
	const { t, locale } = useTranslation(["settings"]);
	const queryClient = useQueryClient();
	const tokens = useGetApiApiTokens();
	const refresh = () => queryClient.invalidateQueries({ queryKey: getApiApiTokensQueryKey() });

	return (
		<section className="max-w-5xl">
			<ManagementWorkspaceSectionHeader
				backHref={SettingsOverviewHref}
				backLabel={t.settings.workspace.backToOverview}
				description={t.settings.tokens.description}
				link={Link}
				title={t.settings.tokens.title}
			/>
			<div className="grid gap-6">
				<Alert variant="destructive">
					<ShieldAlert />
					<AlertTitle>{t.settings.tokens.securityWarningTitle}</AlertTitle>
					<AlertDescription>{t.settings.tokens.securityWarning}</AlertDescription>
				</Alert>
				<CreateTokenCard refresh={refresh} />
				<div className="grid gap-4">
					<div>
						<h2 className="font-heading text-xl font-semibold">
							{t.settings.tokens.listTitle}
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							{t.settings.tokens.listDescription}
						</p>
					</div>
					{tokens.isPending ? <QueryPending /> : null}
					{tokens.isError ? (
						<QueryFailure error={tokens.error} retry={() => void tokens.refetch()} />
					) : null}
					{tokens.data?.items.length === 0 ? (
						<p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
							{t.settings.tokens.empty}
						</p>
					) : null}
					{tokens.data?.items.map((token) => (
						<TokenCard
							key={token.id}
							locale={locale.current}
							refresh={refresh}
							token={token}
						/>
					))}
				</div>
			</div>
		</section>
	);
}
