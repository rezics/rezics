"use client";

import {
	getApiApiQuotaPoliciesQueryKey,
	useGetApiApiQuotaPolicies,
	useGetApiPlatformUsers,
	usePostApiApiQuotaPolicies,
	usePutApiApiQuotaPoliciesByPolicyKey,
	type GetApiApiQuotaPoliciesStatus200,
	type PostApiApiQuotaPoliciesBody,
	type PutApiApiQuotaPoliciesByPolicyKeyBody,
} from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Field,
	FieldDescription,
	FieldLabel,
	Input,
	NativeSelect,
	NativeSelectOption,
	QueryFailure,
	QueryPending,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Textarea,
	cn,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useDeferredValue, useState, type FormEvent } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { AccountApiQuotaEditor } from "../components/account-api-quota-editor";
import { useConsoleWorkspace } from "../components/console-workspace";
import { TokenApiQuotaManager } from "../components/token-api-quota-manager";

type Policy = GetApiApiQuotaPoliciesStatus200["items"][number];
type PolicyConfiguration = PutApiApiQuotaPoliciesByPolicyKeyBody["configuration"];
type Operations = PolicyConfiguration["operations"];
type OperationLimits = NonNullable<Operations[keyof Operations]>;

const OperationIds = [
	"search.execute",
	"image.upload",
] as const satisfies readonly (keyof Operations)[];
const LimitKeys = ["requestRate", "maxConcurrentRequests", "dailyCostUnits"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function parseOperationLimits(value: unknown): OperationLimits | undefined {
	if (!isRecord(value) || Object.keys(value).length === 0) return undefined;
	if (Object.keys(value).some((key) => !LimitKeys.some((allowed) => allowed === key)))
		return undefined;
	const result: OperationLimits = {};
	if (value.requestRate !== undefined) {
		if (
			!isRecord(value.requestRate) ||
			Object.keys(value.requestRate).some(
				(key) => key !== "requestsPerMinute" && key !== "burstCapacity",
			) ||
			!positiveInteger(value.requestRate.requestsPerMinute) ||
			!positiveInteger(value.requestRate.burstCapacity)
		)
			return undefined;
		result.requestRate = {
			requestsPerMinute: value.requestRate.requestsPerMinute,
			burstCapacity: value.requestRate.burstCapacity,
		};
	}
	if (value.maxConcurrentRequests !== undefined) {
		if (!positiveInteger(value.maxConcurrentRequests)) return undefined;
		result.maxConcurrentRequests = value.maxConcurrentRequests;
	}
	if (value.dailyCostUnits !== undefined) {
		if (!positiveInteger(value.dailyCostUnits)) return undefined;
		result.dailyCostUnits = value.dailyCostUnits;
	}
	return result;
}

function parseOperations(value: string): Operations | undefined {
	try {
		const parsed: unknown = JSON.parse(value);
		if (!isRecord(parsed)) return undefined;
		const result: Operations = {};
		for (const operationId of OperationIds) {
			if (!(operationId in parsed)) continue;
			const limits = parseOperationLimits(parsed[operationId]);
			if (!limits) return undefined;
			result[operationId] = limits;
		}
		if (Object.keys(parsed).some((key) => !OperationIds.some((known) => known === key)))
			return undefined;
		return result;
	} catch {
		return undefined;
	}
}

export function ConsoleApiQuotasPage() {
	const { t } = useTranslation(["console"]);
	const { canReadAccountApiQuotas, canReadTokenApiQuotas } = useConsoleWorkspace();
	const canReadAssignments = canReadAccountApiQuotas || canReadTokenApiQuotas;
	return (
		<section>
			<header className="mb-5">
				<h1 className="font-semibold text-xl tracking-tight">
					{t.console.sections.apiQuotas.label}
				</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					{t.console.sections.apiQuotas.description}
				</p>
			</header>
			<Tabs defaultValue="policies">
				<TabsList className="mb-5" variant="underline">
					<TabsTrigger value="policies">{t.console.apiQuotas.policyList}</TabsTrigger>
					<TabsTrigger disabled={!canReadAssignments} value="assignments">
						{t.console.apiQuotas.assignments}
					</TabsTrigger>
				</TabsList>
				<TabsContent value="policies">
					<PolicyManagement />
				</TabsContent>
				<TabsContent value="assignments">
					<QuotaAssignments />
				</TabsContent>
			</Tabs>
		</section>
	);
}

function PolicyManagement() {
	const { t } = useTranslation(["console", "errors"]);
	const { canReadApiQuotaPolicies, canUpdateApiQuotaPolicies } = useConsoleWorkspace();
	const policies = useGetApiApiQuotaPolicies({
		query: { enabled: canReadApiQuotaPolicies },
	});
	const [selectedKey, setSelectedKey] = useState("");
	const [creating, setCreating] = useState(false);

	if (!canReadApiQuotaPolicies)
		return <p className="text-destructive text-sm">{t.errors.forbidden}</p>;
	if (policies.isPending) return <QueryPending />;
	if (policies.isError || !policies.data)
		return <QueryFailure error={policies.error} retry={() => void policies.refetch()} />;
	const selected =
		policies.data.items.find((policy) => policy.key === selectedKey) ?? policies.data.items[0];

	return selected || canUpdateApiQuotaPolicies ? (
		<div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
			<Card appearance="outlined">
				<CardHeader className="flex-row items-center justify-between gap-3">
					<CardTitle>{t.console.apiQuotas.policyList}</CardTitle>
					{canUpdateApiQuotaPolicies ? (
						<Button onClick={() => setCreating(true)} size="sm" variant="outline">
							{t.console.apiQuotas.newPolicy}
						</Button>
					) : null}
				</CardHeader>
				<CardContent className="grid gap-1">
					{policies.data.items.map((policy) => (
						<button
							className={cn(
								"flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start text-sm",
								policy.key === selected?.key ? "bg-primary/10 text-primary" : "hover:bg-accent",
							)}
							key={policy.id}
							onClick={() => {
								setSelectedKey(policy.key);
								setCreating(false);
							}}
							type="button"
						>
							<span className="min-w-0">
								<span className="block truncate font-medium">{policy.key}</span>
								<span className="text-muted-foreground text-xs">
									{t.console.apiQuotas.subjects[policy.subjectKind]} ·{" "}
									{t.console.apiQuotas.revision({
										revision: Number(policy.revision),
									})}
								</span>
							</span>
							<Badge variant={policy.enabled ? "success" : "outline"}>
								{policy.enabled ? t.console.apiQuotas.enabled : t.console.apiQuotas.disabled}
							</Badge>
						</button>
					))}
				</CardContent>
			</Card>
			{creating ? (
				<ApiQuotaPolicyCreateForm
					onCancel={() => setCreating(false)}
					onCreated={(policyKey) => {
						setSelectedKey(policyKey);
						setCreating(false);
					}}
				/>
			) : selected ? (
				<ApiQuotaPolicyEditor key={`${selected.key}:${selected.revision}`} policy={selected} />
			) : (
				<p className="rounded-lg border border-border p-6 text-center text-muted-foreground text-sm">
					{t.console.apiQuotas.empty}
				</p>
			)}
		</div>
	) : (
		<p className="rounded-lg border border-border p-6 text-center text-muted-foreground text-sm">
			{t.console.apiQuotas.empty}
		</p>
	);
}

function QuotaAssignments() {
	const { t } = useTranslation(["console"]);
	const { canReadAccountApiQuotas, canReadTokenApiQuotas } = useConsoleWorkspace();
	const canReadAssignments = canReadAccountApiQuotas || canReadTokenApiQuotas;
	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search.trim());
	const [selectedUserId, setSelectedUserId] = useState<string>();
	const users = useGetApiPlatformUsers(
		{
			query: {
				limit: 25,
				...(deferredSearch ? { search: deferredSearch } : {}),
			},
		},
		{ query: { enabled: canReadAssignments && deferredSearch.length >= 2 } },
	);
	const selected = users.data?.items.find((user) => user.userId === selectedUserId);

	return (
		<div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
			<Card appearance="outlined">
				<CardHeader>
					<CardTitle>{t.console.users.searchLabel}</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-3">
					<label className="relative">
						<Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							aria-label={t.console.users.searchLabel}
							className="ps-9"
							onChange={(event) => setSearch(event.currentTarget.value)}
							placeholder={t.console.users.searchPlaceholder}
							value={search}
						/>
					</label>
					{users.isFetching ? <QueryPending /> : null}
					{users.isError ? (
						<QueryFailure error={users.error} retry={() => void users.refetch()} />
					) : null}
					<div className="grid gap-1">
						{users.data?.items.map((user) => (
							<button
								className={cn(
									"rounded-lg px-3 py-2 text-start",
									selectedUserId === user.userId ? "bg-primary/10 text-primary" : "hover:bg-accent",
								)}
								key={user.userId}
								onClick={() => setSelectedUserId(user.userId)}
								type="button"
							>
								<span className="block truncate font-medium text-sm">{user.name}</span>
								<span className="block truncate text-muted-foreground text-xs">{user.email}</span>
							</button>
						))}
					</div>
				</CardContent>
			</Card>
			{selected ? (
				<div className="grid gap-6">
					<header>
						<h2 className="font-semibold">{selected.name}</h2>
						<p className="text-muted-foreground text-sm">{selected.email}</p>
					</header>
					{canReadAccountApiQuotas ? <AccountApiQuotaEditor userId={selected.userId} /> : null}
					<TokenApiQuotaManager userId={selected.userId} />
				</div>
			) : (
				<div className="grid min-h-64 place-items-center rounded-lg border border-border p-8 text-center">
					<div>
						<p className="font-medium">{t.console.users.selectUser}</p>
						<p className="mt-1 text-muted-foreground text-sm">
							{t.console.users.selectUserDescription}
						</p>
					</div>
				</div>
			)}
		</div>
	);
}

function ApiQuotaPolicyCreateForm({
	onCancel,
	onCreated,
}: {
	readonly onCancel: () => void;
	readonly onCreated: (policyKey: string) => void;
}) {
	const { t } = useTranslation(["console"]);
	const queryClient = useQueryClient();
	const [key, setKey] = useState("");
	const [subjectKind, setSubjectKind] =
		useState<PostApiApiQuotaPoliciesBody["subjectKind"]>("account");
	const [policyClass, setPolicyClass] = useState<PostApiApiQuotaPoliciesBody["class"]>("standard");
	const [requestsPerMinute, setRequestsPerMinute] = useState(60);
	const [burstCapacity, setBurstCapacity] = useState(10);
	const [maxConcurrentRequests, setMaxConcurrentRequests] = useState(2);
	const [dailyCostUnits, setDailyCostUnits] = useState(2_000);
	const [maxActiveTokens, setMaxActiveTokens] = useState(10);
	const [operationsText, setOperationsText] = useState("{}");
	const [reason, setReason] = useState("");
	const operations = parseOperations(operationsText);
	const limitsValid = [
		requestsPerMinute,
		burstCapacity,
		maxConcurrentRequests,
		dailyCostUnits,
		...(subjectKind === "account" ? [maxActiveTokens] : []),
	].every((value) => Number.isSafeInteger(value) && value > 0);
	const mutation = usePostApiApiQuotaPolicies({
		mutation: {
			onSuccess: async (created) => {
				await queryClient.invalidateQueries({
					queryKey: getApiApiQuotaPoliciesQueryKey(),
				});
				onCreated(created.key);
			},
		},
	});

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const trimmedReason = reason.trim();
		if (!operations || !limitsValid || !trimmedReason) return;
		mutation.mutate({
			body: {
				key: key.trim(),
				subjectKind,
				class: policyClass,
				reason: trimmedReason,
				configuration:
					subjectKind === "account"
						? {
								limits: {
									requestRate: { requestsPerMinute, burstCapacity },
									maxConcurrentRequests,
									dailyCostUnits,
								},
								maxActiveTokens,
								operations,
							}
						: {
								limits: {
									requestRate: { requestsPerMinute, burstCapacity },
									maxConcurrentRequests,
									dailyCostUnits,
								},
								operations,
							},
			},
		});
	}

	return (
		<Card appearance="outlined">
			<CardHeader className="border-border border-b">
				<CardTitle>{t.console.apiQuotas.createPolicy}</CardTitle>
				<CardDescription>{t.console.apiQuotas.createPolicyDescription}</CardDescription>
			</CardHeader>
			<CardContent>
				<form className="grid gap-5" onSubmit={submit}>
					<div className="grid gap-4 sm:grid-cols-3">
						<Field required>
							<FieldLabel>{t.console.apiQuotas.policyKey}</FieldLabel>
							<Input
								maxLength={64}
								onChange={(event) => setKey(event.currentTarget.value)}
								pattern="[a-z][a-z0-9_-]{0,63}"
								placeholder={t.console.apiQuotas.policyKeyPlaceholder}
								required
								value={key}
							/>
						</Field>
						<Field required>
							<FieldLabel>{t.console.apiQuotas.subjectKind}</FieldLabel>
							<NativeSelect
								onChange={(event) => {
									const value = event.currentTarget.value;
									if (value === "account" || value === "token") setSubjectKind(value);
								}}
								value={subjectKind}
							>
								<NativeSelectOption value="account">
									{t.console.apiQuotas.subjects.account}
								</NativeSelectOption>
								<NativeSelectOption value="token">
									{t.console.apiQuotas.subjects.token}
								</NativeSelectOption>
							</NativeSelect>
						</Field>
						<Field required>
							<FieldLabel>{t.console.apiQuotas.policyClass}</FieldLabel>
							<NativeSelect
								onChange={(event) => {
									const value = event.currentTarget.value;
									if (value === "standard" || value === "privileged") setPolicyClass(value);
								}}
								value={policyClass}
							>
								<NativeSelectOption value="standard">
									{t.console.apiQuotas.classes.standard}
								</NativeSelectOption>
								<NativeSelectOption value="privileged">
									{t.console.apiQuotas.classes.privileged}
								</NativeSelectOption>
							</NativeSelect>
						</Field>
					</div>
					<div
						className={cn(
							"grid gap-4 sm:grid-cols-2",
							subjectKind === "account" ? "xl:grid-cols-5" : "xl:grid-cols-4",
						)}
					>
						<NumericQuotaField
							disabled={false}
							label={t.console.apiQuotas.requestsPerMinute}
							onChange={setRequestsPerMinute}
							value={requestsPerMinute}
						/>
						<NumericQuotaField
							disabled={false}
							label={t.console.apiQuotas.burstCapacity}
							onChange={setBurstCapacity}
							value={burstCapacity}
						/>
						<NumericQuotaField
							disabled={false}
							label={t.console.apiQuotas.maxConcurrentRequests}
							onChange={setMaxConcurrentRequests}
							value={maxConcurrentRequests}
						/>
						<NumericQuotaField
							disabled={false}
							label={t.console.apiQuotas.dailyCostUnits}
							onChange={setDailyCostUnits}
							value={dailyCostUnits}
						/>
						{subjectKind === "account" ? (
							<NumericQuotaField
								disabled={false}
								label={t.console.apiQuotas.maxActiveTokens}
								onChange={setMaxActiveTokens}
								value={maxActiveTokens}
							/>
						) : null}
					</div>
					<Field invalid={operations === undefined}>
						<FieldLabel>{t.console.apiQuotas.operationOverrides}</FieldLabel>
						<Textarea
							className="min-h-40 font-mono text-xs"
							onChange={(event) => setOperationsText(event.currentTarget.value)}
							spellCheck={false}
							value={operationsText}
						/>
						<FieldDescription>
							{operations === undefined
								? t.console.apiQuotas.invalidOperations
								: t.console.apiQuotas.operationOverridesDescription}
						</FieldDescription>
					</Field>
					<Field required>
						<FieldLabel>{t.console.apiQuotas.changeReason}</FieldLabel>
						<Textarea
							maxLength={1_000}
							onChange={(event) => setReason(event.currentTarget.value)}
							placeholder={t.console.apiQuotas.changeReasonPlaceholder}
							required
							value={reason}
						/>
					</Field>
					<RequestFailure error={mutation.error} fallback={t.console.apiQuotas.createFailed} />
					<div className="flex justify-end gap-2">
						<Button
							disabled={mutation.isPending}
							onClick={onCancel}
							type="button"
							variant="outline"
						>
							{t.console.apiQuotas.cancelCreation}
						</Button>
						<Button isLoading={mutation.isPending} type="submit" variant="solid">
							{t.console.apiQuotas.createPolicy}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}

function ApiQuotaPolicyEditor({ policy }: { readonly policy: Policy }) {
	const { t } = useTranslation(["console"]);
	const { canUpdateApiQuotaPolicies } = useConsoleWorkspace();
	const queryClient = useQueryClient();
	const [requestsPerMinute, setRequestsPerMinute] = useState(
		Number(policy.configuration.limits.requestRate.requestsPerMinute),
	);
	const [burstCapacity, setBurstCapacity] = useState(
		Number(policy.configuration.limits.requestRate.burstCapacity),
	);
	const [maxConcurrentRequests, setMaxConcurrentRequests] = useState(
		Number(policy.configuration.limits.maxConcurrentRequests),
	);
	const [dailyCostUnits, setDailyCostUnits] = useState(
		Number(policy.configuration.limits.dailyCostUnits),
	);
	const isAccountPolicy = policy.subjectKind === "account";
	const [maxActiveTokens, setMaxActiveTokens] = useState(() =>
		"maxActiveTokens" in policy.configuration ? Number(policy.configuration.maxActiveTokens) : 1,
	);
	const [operationsText, setOperationsText] = useState(() =>
		JSON.stringify(policy.configuration.operations, null, 2),
	);
	const [reason, setReason] = useState("");
	const operations = parseOperations(operationsText);
	const mutation = usePutApiApiQuotaPoliciesByPolicyKey({
		mutation: {
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: getApiApiQuotaPoliciesQueryKey(),
				});
			},
		},
	});
	const limitsValid = [
		requestsPerMinute,
		burstCapacity,
		maxConcurrentRequests,
		dailyCostUnits,
		...(isAccountPolicy ? [maxActiveTokens] : []),
	].every((value) => Number.isSafeInteger(value) && value > 0);
	const submit = (event: FormEvent) => {
		event.preventDefault();
		const trimmedReason = reason.trim();
		if (!operations || !limitsValid || !trimmedReason || !canUpdateApiQuotaPolicies) return;
		mutation.mutate({
			path: { policyKey: policy.key },
			body: {
				expectedRevision: policy.revision,
				reason: trimmedReason,
				configuration: isAccountPolicy
					? {
							limits: {
								requestRate: { requestsPerMinute, burstCapacity },
								maxConcurrentRequests,
								dailyCostUnits,
							},
							maxActiveTokens,
							operations,
						}
					: {
							limits: {
								requestRate: { requestsPerMinute, burstCapacity },
								maxConcurrentRequests,
								dailyCostUnits,
							},
							operations,
						},
			},
		});
	};

	return (
		<Card appearance="outlined">
			<CardHeader className="border-border border-b">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<CardTitle>{policy.key}</CardTitle>
						<CardDescription>
							{t.console.apiQuotas.subjects[policy.subjectKind]} · {t.console.apiQuotas.policyClass}
							: {t.console.apiQuotas.classes[policy.class]}
						</CardDescription>
					</div>
					<Badge variant="secondary">
						{t.console.apiQuotas.schemaVersion({
							version: Number(policy.schemaVersion),
						})}
					</Badge>
				</div>
			</CardHeader>
			<CardContent>
				<form className="grid gap-5" onSubmit={submit}>
					<div
						className={cn(
							"grid gap-4 sm:grid-cols-2",
							isAccountPolicy ? "xl:grid-cols-5" : "xl:grid-cols-4",
						)}
					>
						<NumericQuotaField
							disabled={!canUpdateApiQuotaPolicies}
							label={t.console.apiQuotas.requestsPerMinute}
							onChange={setRequestsPerMinute}
							value={requestsPerMinute}
						/>
						<NumericQuotaField
							disabled={!canUpdateApiQuotaPolicies}
							label={t.console.apiQuotas.burstCapacity}
							onChange={setBurstCapacity}
							value={burstCapacity}
						/>
						<NumericQuotaField
							disabled={!canUpdateApiQuotaPolicies}
							label={t.console.apiQuotas.maxConcurrentRequests}
							onChange={setMaxConcurrentRequests}
							value={maxConcurrentRequests}
						/>
						<NumericQuotaField
							disabled={!canUpdateApiQuotaPolicies}
							label={t.console.apiQuotas.dailyCostUnits}
							onChange={setDailyCostUnits}
							value={dailyCostUnits}
						/>
						{isAccountPolicy ? (
							<NumericQuotaField
								disabled={!canUpdateApiQuotaPolicies}
								label={t.console.apiQuotas.maxActiveTokens}
								onChange={setMaxActiveTokens}
								value={maxActiveTokens}
							/>
						) : null}
					</div>
					<Field invalid={operations === undefined}>
						<FieldLabel>{t.console.apiQuotas.operationOverrides}</FieldLabel>
						<Textarea
							className="min-h-56 font-mono text-xs"
							disabled={!canUpdateApiQuotaPolicies}
							onChange={(event) => setOperationsText(event.currentTarget.value)}
							spellCheck={false}
							value={operationsText}
						/>
						<FieldDescription>
							{operations === undefined
								? t.console.apiQuotas.invalidOperations
								: t.console.apiQuotas.operationOverridesDescription}
						</FieldDescription>
					</Field>
					<Field required>
						<FieldLabel>{t.console.apiQuotas.changeReason}</FieldLabel>
						<Textarea
							disabled={!canUpdateApiQuotaPolicies}
							maxLength={1_000}
							onChange={(event) => setReason(event.currentTarget.value)}
							placeholder={t.console.apiQuotas.changeReasonPlaceholder}
							required
							value={reason}
						/>
					</Field>
					<RequestFailure error={mutation.error} fallback={t.console.apiQuotas.updateFailed} />
					{canUpdateApiQuotaPolicies ? (
						<div className="flex justify-end">
							<Button isLoading={mutation.isPending} type="submit" variant="solid">
								{t.console.apiQuotas.save}
							</Button>
						</div>
					) : (
						<p className="text-muted-foreground text-sm">{t.console.apiQuotas.readOnly}</p>
					)}
				</form>
			</CardContent>
		</Card>
	);
}

function NumericQuotaField({
	disabled,
	label,
	onChange,
	value,
}: {
	readonly disabled: boolean;
	readonly label: string;
	readonly onChange: (value: number) => void;
	readonly value: number;
}) {
	return (
		<Field>
			<FieldLabel>{label}</FieldLabel>
			<Input
				disabled={disabled}
				max={Number.MAX_SAFE_INTEGER}
				min={1}
				onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
				required
				type="number"
				value={value}
			/>
		</Field>
	);
}
