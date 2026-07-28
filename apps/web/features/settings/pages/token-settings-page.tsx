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
import { KeyRound, Plus, ShieldAlert, Trash2, XIcon } from "lucide-react";
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
	Clipboard,
	ClipboardIndicator,
	ClipboardInput,
	ClipboardTrigger,
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
	Input,
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	ManagementWorkspaceSectionHeader,
	NativeSelect,
	NativeSelectOption,
	PermissionMatrix,
	type PermissionMatrixLabels,
	type PermissionMatrixResource,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { RequestFailure } from "@/i18n/request-failure";
import { useTranslation } from "@/i18n/client";
import {
	getTokenPolicyLimitRanges,
	parseTokenPolicyLimit,
	parseTokenPolicyLimits,
	StandardTokenPolicyLimitRanges,
	type TokenPolicyLimitName,
	type TokenPolicyLimitRanges,
	type TokenPolicyLimitValues,
	type ValidTokenPolicyLimits,
} from "../model/token-policy-limits";
import { SettingsOverviewHref } from "../routing/settings-routes";

type TokenRecord = GetApiApiTokensStatus200["items"][number];
type ApiTokenPermission =
	(typeof PostApiApiTokensRequestPermissionsEnum)[keyof typeof PostApiApiTokensRequestPermissionsEnum];
type PermissionCategory = "content" | "identity" | "communication" | "platform";
type PermissionResource =
	| "unit"
	| "profile"
	| "interaction"
	| "realm"
	| "message"
	| "notification"
	| "recommendation"
	| "upload"
	| "report";
type PermissionAction = "read" | "create" | "update" | "delete" | "write" | "manage";

const PermissionGroups = [
	{
		id: "unit",
		category: "content",
		actions: [
			["unit:read", "read"],
			["unit:create", "create"],
			["unit:update", "update"],
			["unit:delete", "delete"],
		],
	},
	{
		id: "profile",
		category: "identity",
		actions: [
			["profile:read", "read"],
			["profile:update", "update"],
		],
	},
	{
		id: "interaction",
		category: "content",
		actions: [
			["interaction:read", "read"],
			["interaction:write", "write"],
		],
	},
	{
		id: "realm",
		category: "content",
		actions: [
			["realm:read", "read"],
			["realm:manage", "manage"],
		],
	},
	{
		id: "message",
		category: "communication",
		actions: [
			["message:read", "read"],
			["message:write", "write"],
		],
	},
	{
		id: "notification",
		category: "communication",
		actions: [
			["notification:read", "read"],
			["notification:write", "write"],
		],
	},
	{
		id: "recommendation",
		category: "content",
		actions: [
			["recommendation:read", "read"],
			["recommendation:write", "write"],
		],
	},
	{
		id: "upload",
		category: "content",
		actions: [
			["upload:read", "read"],
			["upload:write", "write"],
		],
	},
	{
		id: "report",
		category: "platform",
		actions: [["report:write", "write"]],
	},
] as const satisfies readonly {
	id: PermissionResource;
	category: PermissionCategory;
	actions: readonly (readonly [ApiTokenPermission, PermissionAction])[];
}[];

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

function PermissionFields({
	selected,
	onChange,
}: {
	selected: readonly ApiTokenPermission[];
	onChange: (permissions: ApiTokenPermission[]) => void;
}) {
	const { t } = useTranslation(["settings"]);
	const resources: PermissionMatrixResource<ApiTokenPermission>[] = PermissionGroups.map(
		(group) => ({
			id: group.id,
			category: t.settings.tokens.permissionCategories[group.category],
			label: t.settings.tokens.permissionResources[group.id],
			keywords: group.actions.map(([permission]) => permission),
			actions: group.actions.map(([value, action]) => ({
				value,
				label: t.settings.tokens.permissionActions[action],
				description:
					t.settings.tokens.permissionLabels[
						(
							{
								"unit:read": "unitRead",
								"unit:create": "unitCreate",
								"unit:update": "unitUpdate",
								"unit:delete": "unitDelete",
								"profile:read": "profileRead",
								"profile:update": "profileUpdate",
								"interaction:read": "interactionRead",
								"interaction:write": "interactionWrite",
								"realm:read": "realmRead",
								"realm:manage": "realmManage",
								"message:read": "messageRead",
								"message:write": "messageWrite",
								"notification:read": "notificationRead",
								"notification:write": "notificationWrite",
								"recommendation:read": "recommendationRead",
								"recommendation:write": "recommendationWrite",
								"upload:read": "uploadRead",
								"upload:write": "uploadWrite",
								"report:write": "reportWrite",
							} as const
						)[value]
					],
			})),
		}),
	);
	const labels: PermissionMatrixLabels = {
		templates: t.settings.tokens.matrix.templates,
		permissions: t.settings.tokens.permissions,
		searchPlaceholder: t.settings.tokens.matrix.searchPlaceholder,
		clear: t.settings.tokens.matrix.clear,
		selected: (selectedCount, total) =>
			t.settings.tokens.matrix.selected({ selected: selectedCount, total }),
		categorySelected: (selectedCount) =>
			t.settings.tokens.matrix.categorySelected({ selected: selectedCount }),
		required: t.settings.tokens.matrix.required,
		empty: t.settings.tokens.matrix.empty,
	};
	return (
		<PermissionMatrix
			labels={labels}
			onValueChange={(values) =>
				onChange(
					PermissionGroups.flatMap((group) =>
						group.actions.map(([permission]) => permission),
					).filter((permission) => values.has(permission)),
				)
			}
			resources={resources}
			templates={[
				{
					id: "content-agent",
					label: t.settings.tokens.selectContentAgent,
					values: new Set(ContentAgentPermissions),
				},
				{
					id: "read-only",
					label: t.settings.tokens.selectReadOnly,
					values: new Set(ReadOnlyPermissions),
				},
			]}
			value={new Set(selected)}
		/>
	);
}

function LimitRangeDescription({ ranges }: { ranges: TokenPolicyLimitRanges }) {
	const { t, locale } = useTranslation(["settings"]);
	const format = (value: number) => value.toLocaleString(locale.current);
	return (
		<FieldDescription>
			{t.settings.tokens.limitRanges({
				requestsMinimum: format(ranges.requestsPerMinute.minimum),
				requestsMaximum: format(ranges.requestsPerMinute.maximum),
				concurrentMinimum: format(ranges.maxConcurrentRequests.minimum),
				concurrentMaximum: format(ranges.maxConcurrentRequests.maximum),
				dailyMinimum: format(ranges.dailyCostUnits.minimum),
				dailyMaximum: format(ranges.dailyCostUnits.maximum),
			})}
		</FieldDescription>
	);
}

export function PolicyLimitField({
	label,
	name,
	onChange,
	range,
	value,
}: {
	label: string;
	name: TokenPolicyLimitName;
	onChange: (value: string) => void;
	range: TokenPolicyLimitRanges[TokenPolicyLimitName];
	value: string;
}) {
	const { t, locale } = useTranslation(["settings"]);
	const parsed = parseTokenPolicyLimit(value, range);
	const invalid = parsed.kind === "invalid";
	const minimum = range.minimum.toLocaleString(locale.current);
	const maximum = range.maximum.toLocaleString(locale.current);
	return (
		<Field invalid={invalid} required>
			<FieldLabel>{label}</FieldLabel>
			<InputGroup>
				<InputGroupInput
					aria-invalid={invalid || undefined}
					max={range.maximum}
					min={range.minimum}
					name={name}
					onChange={(event) => onChange(event.currentTarget.value)}
					placeholder={t.settings.tokens.limitRangePlaceholder({ minimum, maximum })}
					required
					step={1}
					type="number"
					value={value}
				/>
				{invalid ? (
					<InputGroupAddon align="inline-end" className="text-destructive">
						<XIcon aria-hidden />
					</InputGroupAddon>
				) : null}
			</InputGroup>
			{invalid ? (
				<FieldError>{t.settings.tokens.limitRangeError({ minimum, maximum })}</FieldError>
			) : null}
		</Field>
	);
}

function PolicyLimitFields({
	onChange,
	ranges,
	values,
}: {
	onChange: (name: TokenPolicyLimitName, value: string) => void;
	ranges: TokenPolicyLimitRanges;
	values: TokenPolicyLimitValues;
}) {
	const { t } = useTranslation(["settings"]);
	return (
		<div className="grid gap-4 sm:grid-cols-3">
			<PolicyLimitField
				label={t.settings.tokens.requestsPerMinute}
				name="requestsPerMinute"
				onChange={(value) => onChange("requestsPerMinute", value)}
				range={ranges.requestsPerMinute}
				value={values.requestsPerMinute}
			/>
			<PolicyLimitField
				label={t.settings.tokens.maxConcurrentRequests}
				name="maxConcurrentRequests"
				onChange={(value) => onChange("maxConcurrentRequests", value)}
				range={ranges.maxConcurrentRequests}
				value={values.maxConcurrentRequests}
			/>
			<PolicyLimitField
				label={t.settings.tokens.dailyCostUnits}
				name="dailyCostUnits"
				onChange={(value) => onChange("dailyCostUnits", value)}
				range={ranges.dailyCostUnits}
				value={values.dailyCostUnits}
			/>
		</div>
	);
}

function CreateTokenCard({ refresh }: { refresh: () => Promise<unknown> }) {
	const { t } = useTranslation(["settings", "ui"]);
	const [permissions, setPermissions] = useState<ApiTokenPermission[]>([
		...ContentAgentPermissions,
	]);
	const [limitValues, setLimitValues] = useState<TokenPolicyLimitValues>({
		requestsPerMinute: "60",
		maxConcurrentRequests: "2",
		dailyCostUnits: "2000",
	});
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
		const limits = parseTokenPolicyLimits(limitValues, StandardTokenPolicyLimitRanges);
		if (permissions.length === 0 || !limits.valid) return;
		const form = new FormData(event.currentTarget);
		await create.mutateAsync({
			body: {
				name: String(form.get("name") ?? "").trim(),
				expiresInDays: Number(form.get("expiresInDays")),
				permissions,
				policyOverride: {
					limits: limits.values,
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
							<PermissionFields selected={permissions} onChange={setPermissions} />
							{permissionsInvalid ? (
								<p className="text-sm text-destructive" role="alert">
									{t.settings.tokens.permissionsRequired}
								</p>
							) : null}
						</FieldSet>
						<FieldSet>
							<FieldLegend variant="label">{t.settings.tokens.limits}</FieldLegend>
							<FieldDescription>
								{t.settings.tokens.standardLimitsDescription}
							</FieldDescription>
							<LimitRangeDescription ranges={StandardTokenPolicyLimitRanges} />
							<PolicyLimitFields
								onChange={(name, value) =>
									setLimitValues((current) => ({ ...current, [name]: value }))
								}
								ranges={StandardTokenPolicyLimitRanges}
								values={limitValues}
							/>
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

type OperationLimitRow = TokenPolicyLimitValues & {
	key: string;
	operationId: string;
};

function TokenPolicyEditor({
	token,
	refresh,
}: {
	token: TokenRecord;
	refresh: () => Promise<unknown>;
}) {
	const { t } = useTranslation(["settings", "ui"]);
	const ranges = getTokenPolicyLimitRanges(token.policy.kind);
	const [limitValues, setLimitValues] = useState<TokenPolicyLimitValues>(() => ({
		requestsPerMinute: String(token.policy.limits.requestsPerMinute),
		maxConcurrentRequests: String(token.policy.limits.maxConcurrentRequests),
		dailyCostUnits: String(token.policy.limits.dailyCostUnits),
	}));
	const [operations, setOperations] = useState<OperationLimitRow[]>(() =>
		Object.entries(token.policy.operations).map(([operationId, limits], index) => ({
			key: `stored-${index}-${operationId}`,
			operationId,
			requestsPerMinute: String(limits.requestsPerMinute ?? limitValues.requestsPerMinute),
			maxConcurrentRequests: String(
				limits.maxConcurrentRequests ?? limitValues.maxConcurrentRequests,
			),
			dailyCostUnits: String(limits.dailyCostUnits ?? limitValues.dailyCostUnits),
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
		const limits = parseTokenPolicyLimits(limitValues, ranges);
		const configurationOperations: Record<string, ValidTokenPolicyLimits> = {};
		let operationsValid = true;
		for (const operation of operations) {
			const operationId = operation.operationId.trim();
			const operationLimits = parseTokenPolicyLimits(operation, ranges);
			if (
				!/^[A-Za-z][A-Za-z0-9_-]*$/.test(operationId) ||
				Object.hasOwn(configurationOperations, operationId) ||
				!operationLimits.valid
			) {
				operationsValid = false;
				continue;
			}
			configurationOperations[operationId] = operationLimits.values;
		}
		setInvalid(!limits.valid || !operationsValid);
		if (!limits.valid || !operationsValid) return;
		await replace.mutateAsync({
			path: { tokenId: token.id },
			body: {
				expectedRevision: Number(token.policy.bindingRevision ?? 1),
				configurationOverride: {
					limits: limits.values,
					operations: configurationOperations,
				},
			},
		});
	}

	return (
		<form className="grid gap-5 rounded-lg border border-border-weak p-4" onSubmit={submit}>
			<FieldSet>
				<FieldLegend variant="label">{t.settings.tokens.limits}</FieldLegend>
				<FieldDescription>{t.settings.tokens.limitsDescription}</FieldDescription>
				<LimitRangeDescription ranges={ranges} />
				<PolicyLimitFields
					onChange={(name, value) =>
						setLimitValues((current) => ({ ...current, [name]: value }))
					}
					ranges={ranges}
					values={limitValues}
				/>
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
							<PolicyLimitField
								label={t.settings.tokens.requestsPerMinute}
								name="requestsPerMinute"
								onChange={(value) =>
									updateOperation(operation.key, { requestsPerMinute: value })
								}
								range={ranges.requestsPerMinute}
								value={operation.requestsPerMinute}
							/>
							<PolicyLimitField
								label={t.settings.tokens.maxConcurrentRequests}
								name="maxConcurrentRequests"
								onChange={(value) =>
									updateOperation(operation.key, { maxConcurrentRequests: value })
								}
								range={ranges.maxConcurrentRequests}
								value={operation.maxConcurrentRequests}
							/>
							<PolicyLimitField
								label={t.settings.tokens.dailyCostUnits}
								name="dailyCostUnits"
								onChange={(value) =>
									updateOperation(operation.key, { dailyCostUnits: value })
								}
								range={ranges.dailyCostUnits}
								value={operation.dailyCostUnits}
							/>
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
					onClick={() => {
						const requestsPerMinute = parseTokenPolicyLimit(
							limitValues.requestsPerMinute,
							ranges.requestsPerMinute,
						);
						const dailyCostUnits = parseTokenPolicyLimit(
							limitValues.dailyCostUnits,
							ranges.dailyCostUnits,
						);
						setOperations((current) => [
							...current,
							{
								key: `new-${crypto.randomUUID()}`,
								operationId: "",
								requestsPerMinute: String(
									requestsPerMinute.kind === "valid"
										? Math.min(requestsPerMinute.value, 30)
										: 30,
								),
								maxConcurrentRequests: "1",
								dailyCostUnits: String(
									dailyCostUnits.kind === "valid"
										? Math.min(dailyCostUnits.value, 1_000)
										: 1_000,
								),
							},
						]);
					}}
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
			: token.policy.kind === "privileged"
				? t.settings.tokens.privilegedPolicy
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
						<Badge variant={token.policy.kind === "privileged" ? "warning" : "outline"}>
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
				{token.policy.kind === "privileged" && token.policy.validUntil ? (
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
