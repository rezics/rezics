"use client";

import {
	getApiApiQuotaPoliciesAccountsByUserIdQueryKey,
	useDeleteApiApiQuotaPoliciesAccountsByUserId,
	useGetApiApiQuotaPolicies,
	useGetApiApiQuotaPoliciesAccountsByUserId,
	usePutApiApiQuotaPoliciesAccountsByUserId,
	type GetApiApiQuotaPoliciesAccountsByUserIdStatus200,
	type GetApiApiQuotaPoliciesStatus200,
	type PutApiApiQuotaPoliciesAccountsByUserIdBody,
} from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Checkbox,
	Field,
	FieldDescription,
	FieldLabel,
	Input,
	NativeSelect,
	NativeSelectOption,
	QueryFailure,
	QueryPending,
	Textarea,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useConsoleWorkspace } from "./console-workspace";

type AccountQuota = GetApiApiQuotaPoliciesAccountsByUserIdStatus200;
type Policy = GetApiApiQuotaPoliciesStatus200["items"][number];
type AccountOverride = NonNullable<
	PutApiApiQuotaPoliciesAccountsByUserIdBody["configurationOverride"]
>;
type Operations = NonNullable<AccountOverride["operations"]>;
type OperationLimits = NonNullable<Operations[keyof Operations]>;
type PolicyClass = Policy["class"];

const OperationIds = [
	"search.execute",
	"image.upload",
] as const satisfies readonly (keyof Operations)[];
const OperationLimitKeys = ["requestRate", "maxConcurrentRequests", "dailyCostUnits"] as const;

const LimitRanges = {
	standard: {
		requestsPerMinute: { minimum: 1, maximum: 300 },
		burstCapacity: { minimum: 1, maximum: 300 },
		maxConcurrentRequests: { minimum: 1, maximum: 4 },
		dailyCostUnits: { minimum: 1, maximum: 10_000 },
		maxActiveTokens: { minimum: 1, maximum: 20 },
	},
	privileged: {
		requestsPerMinute: { minimum: 1, maximum: 5_000 },
		burstCapacity: { minimum: 1, maximum: 5_000 },
		maxConcurrentRequests: { minimum: 1, maximum: 64 },
		dailyCostUnits: { minimum: 1, maximum: 1_000_000 },
		maxActiveTokens: { minimum: 1, maximum: 50 },
	},
} as const;

type LimitName = keyof (typeof LimitRanges)["standard"];
type LimitValues = Record<LimitName, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseIntegerInRange(
	value: unknown,
	range: Readonly<{ minimum: number; maximum: number }>,
): number | undefined {
	return typeof value === "number" &&
		Number.isInteger(value) &&
		value >= range.minimum &&
		value <= range.maximum
		? value
		: undefined;
}

function parseOperationLimits(
	value: unknown,
	policyClass: PolicyClass,
): OperationLimits | undefined {
	if (!isRecord(value) || Object.keys(value).length === 0) return undefined;
	if (Object.keys(value).some((key) => !OperationLimitKeys.some((allowed) => allowed === key)))
		return undefined;
	const ranges = LimitRanges[policyClass];
	const result: OperationLimits = {};
	if (value.requestRate !== undefined) {
		if (
			!isRecord(value.requestRate) ||
			Object.keys(value.requestRate).some(
				(key) => key !== "requestsPerMinute" && key !== "burstCapacity",
			)
		)
			return undefined;
		const requestsPerMinute = parseIntegerInRange(
			value.requestRate.requestsPerMinute,
			ranges.requestsPerMinute,
		);
		const burstCapacity = parseIntegerInRange(
			value.requestRate.burstCapacity,
			ranges.burstCapacity,
		);
		if (requestsPerMinute === undefined || burstCapacity === undefined) return undefined;
		result.requestRate = { requestsPerMinute, burstCapacity };
	}
	if (value.maxConcurrentRequests !== undefined) {
		const maxConcurrentRequests = parseIntegerInRange(
			value.maxConcurrentRequests,
			ranges.maxConcurrentRequests,
		);
		if (maxConcurrentRequests === undefined) return undefined;
		result.maxConcurrentRequests = maxConcurrentRequests;
	}
	if (value.dailyCostUnits !== undefined) {
		const dailyCostUnits = parseIntegerInRange(value.dailyCostUnits, ranges.dailyCostUnits);
		if (dailyCostUnits === undefined) return undefined;
		result.dailyCostUnits = dailyCostUnits;
	}
	return result;
}

function parseOperations(value: string, policyClass: PolicyClass): Operations | undefined {
	try {
		const parsed: unknown = JSON.parse(value);
		if (!isRecord(parsed)) return undefined;
		const result: Operations = {};
		for (const operationId of OperationIds) {
			if (!(operationId in parsed)) continue;
			const limits = parseOperationLimits(parsed[operationId], policyClass);
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

function initialLimitValues(quota: AccountQuota): LimitValues {
	const override = quota.configurationOverride;
	return {
		requestsPerMinute: String(
			override.limits?.requestRate?.requestsPerMinute ??
				quota.limits.requestRate.requestsPerMinute,
		),
		burstCapacity: String(
			override.limits?.requestRate?.burstCapacity ?? quota.limits.requestRate.burstCapacity,
		),
		maxConcurrentRequests: String(
			override.limits?.maxConcurrentRequests ?? quota.limits.maxConcurrentRequests,
		),
		dailyCostUnits: String(override.limits?.dailyCostUnits ?? quota.limits.dailyCostUnits),
		maxActiveTokens: String(override.maxActiveTokens ?? quota.maxActiveTokens),
	};
}

function localDateTime(value: string | null): string {
	if (!value) return "";
	const date = new Date(value);
	const offset = date.getTimezoneOffset() * 60_000;
	return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function hasConfigurationOverride(quota: AccountQuota): boolean {
	return Object.keys(quota.configurationOverride).length > 0;
}

export function AccountApiQuotaEditor({ userId }: { readonly userId: string }) {
	const { t } = useTranslation(["console"]);
	const { canReadAccountApiQuotas, canUpdateAccountApiQuotas } = useConsoleWorkspace();
	const quota = useGetApiApiQuotaPoliciesAccountsByUserId(
		{ path: { userId } },
		{ query: { enabled: canReadAccountApiQuotas } },
	);
	const policies = useGetApiApiQuotaPolicies({
		query: { enabled: canUpdateAccountApiQuotas },
	});

	if (!canReadAccountApiQuotas)
		return <p className="text-destructive text-sm">{t.console.users.quotaUnavailable}</p>;
	if (quota.isPending || (canUpdateAccountApiQuotas && policies.isPending))
		return <QueryPending />;
	if (quota.isError || !quota.data)
		return <QueryFailure error={quota.error} retry={() => void quota.refetch()} />;
	if (canUpdateAccountApiQuotas && (policies.isError || !policies.data))
		return <QueryFailure error={policies.error} retry={() => void policies.refetch()} />;

	return (
		<AccountApiQuotaForm
			key={`${userId}:${quota.data.key}:${quota.data.policyRevision}:${quota.data.bindingRevision ?? 0}`}
			policies={policies.data?.items ?? []}
			quota={quota.data}
			userId={userId}
		/>
	);
}

function AccountApiQuotaForm({
	policies,
	quota,
	userId,
}: {
	readonly policies: readonly Policy[];
	readonly quota: AccountQuota;
	readonly userId: string;
}) {
	const { t } = useTranslation(["console"]);
	const { canUpdateAccountApiQuotas } = useConsoleWorkspace();
	const queryClient = useQueryClient();
	const enabledPolicies = policies.filter((policy) => policy.enabled);
	const [policyKey, setPolicyKey] = useState(quota.key);
	const selectedPolicy =
		enabledPolicies.find((policy) => policy.key === policyKey) ?? enabledPolicies[0];
	const selectedClass = selectedPolicy?.class ?? quota.class;
	const [customize, setCustomize] = useState(hasConfigurationOverride(quota));
	const [limits, setLimits] = useState<LimitValues>(() => initialLimitValues(quota));
	const [operationsText, setOperationsText] = useState(() =>
		JSON.stringify(quota.configurationOverride.operations ?? {}, null, 2),
	);
	const [validUntil, setValidUntil] = useState(() => localDateTime(quota.validUntil));
	const [reason, setReason] = useState("");
	const [invalid, setInvalid] = useState(false);
	const operations = parseOperations(operationsText, selectedClass);
	const queryKey = getApiApiQuotaPoliciesAccountsByUserIdQueryKey({ path: { userId } });
	const refresh = async () => {
		await queryClient.invalidateQueries({ queryKey });
	};
	const assign = usePutApiApiQuotaPoliciesAccountsByUserId<unknown>({
		mutation: { onSuccess: refresh },
	});
	const reset = useDeleteApiApiQuotaPoliciesAccountsByUserId<unknown>({
		mutation: { onSuccess: refresh },
	});

	function selectPolicy(nextKey: string) {
		setPolicyKey(nextKey);
		const nextPolicy = enabledPolicies.find((policy) => policy.key === nextKey);
		if (!nextPolicy) return;
		setLimits({
			requestsPerMinute: String(
				nextPolicy.configuration.limits.requestRate.requestsPerMinute,
			),
			burstCapacity: String(nextPolicy.configuration.limits.requestRate.burstCapacity),
			maxConcurrentRequests: String(nextPolicy.configuration.limits.maxConcurrentRequests),
			dailyCostUnits: String(nextPolicy.configuration.limits.dailyCostUnits),
			maxActiveTokens: String(nextPolicy.configuration.maxActiveTokens),
		});
		setOperationsText("{}");
		setInvalid(false);
		if (nextPolicy.class === "standard") setValidUntil("");
	}

	function parsedLimits(): AccountOverride | undefined {
		if (!customize) return {};
		const ranges = LimitRanges[selectedClass];
		const requestsPerMinute = parseIntegerInRange(
			Number(limits.requestsPerMinute),
			ranges.requestsPerMinute,
		);
		const burstCapacity = parseIntegerInRange(
			Number(limits.burstCapacity),
			ranges.burstCapacity,
		);
		const maxConcurrentRequests = parseIntegerInRange(
			Number(limits.maxConcurrentRequests),
			ranges.maxConcurrentRequests,
		);
		const dailyCostUnits = parseIntegerInRange(
			Number(limits.dailyCostUnits),
			ranges.dailyCostUnits,
		);
		const maxActiveTokens = parseIntegerInRange(
			Number(limits.maxActiveTokens),
			ranges.maxActiveTokens,
		);
		if (
			requestsPerMinute === undefined ||
			burstCapacity === undefined ||
			maxConcurrentRequests === undefined ||
			dailyCostUnits === undefined ||
			maxActiveTokens === undefined ||
			operations === undefined
		)
			return undefined;
		return {
			limits: {
				requestRate: { requestsPerMinute, burstCapacity },
				maxConcurrentRequests,
				dailyCostUnits,
			},
			maxActiveTokens,
			operations,
		};
	}

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!selectedPolicy || !canUpdateAccountApiQuotas) return;
		const configurationOverride = parsedLimits();
		const trimmedReason = reason.trim();
		const expiry = validUntil ? new Date(validUntil) : undefined;
		const expiryValid =
			selectedPolicy.class === "standard" ||
			(expiry !== undefined && Number.isFinite(expiry.getTime()) && expiry > new Date());
		const formInvalid = !configurationOverride || !trimmedReason || !expiryValid;
		setInvalid(formInvalid);
		if (formInvalid) return;
		await assign.mutateAsync({
			path: { userId },
			body: {
				expectedRevision: Number(quota.bindingRevision ?? 0),
				policyKey: selectedPolicy.key,
				reason: trimmedReason,
				configurationOverride,
				...(selectedPolicy.class === "privileged" && expiry
					? { validUntil: expiry.toISOString() }
					: {}),
			},
		});
	}

	async function resetAssignment() {
		if (quota.bindingRevision === null || !canUpdateAccountApiQuotas) return;
		await reset.mutateAsync({
			path: { userId },
			body: { expectedRevision: Number(quota.bindingRevision) },
		});
	}

	const ranges = LimitRanges[selectedClass];
	const sourceLabel = t.console.users.accountQuota.sources[quota.source];
	return (
		<Card appearance="outlined">
			<CardHeader>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<CardTitle>{t.console.users.accountQuota.title}</CardTitle>
						<CardDescription>
							{t.console.users.accountQuota.description}
						</CardDescription>
					</div>
					<div className="flex flex-wrap gap-2">
						<Badge variant="secondary">
							{t.console.apiQuotas.classes[quota.class]}
						</Badge>
						<Badge
							variant={quota.source === "privileged_fallback" ? "warning" : "outline"}
						>
							{sourceLabel}
						</Badge>
					</div>
				</div>
			</CardHeader>
			<CardContent className="grid gap-5">
				<div className="grid gap-3 rounded-lg bg-muted/35 p-4 text-sm sm:grid-cols-2 xl:grid-cols-5">
					<QuotaValue
						label={t.console.apiQuotas.requestsPerMinute}
						value={quota.limits.requestRate.requestsPerMinute}
					/>
					<QuotaValue
						label={t.console.apiQuotas.burstCapacity}
						value={quota.limits.requestRate.burstCapacity}
					/>
					<QuotaValue
						label={t.console.apiQuotas.maxConcurrentRequests}
						value={quota.limits.maxConcurrentRequests}
					/>
					<QuotaValue
						label={t.console.apiQuotas.dailyCostUnits}
						value={quota.limits.dailyCostUnits}
					/>
					<QuotaValue
						label={t.console.apiQuotas.maxActiveTokens}
						value={quota.maxActiveTokens}
					/>
				</div>
				{canUpdateAccountApiQuotas && selectedPolicy ? (
					<form className="grid gap-5" onSubmit={submit}>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field required>
								<FieldLabel>{t.console.users.accountQuota.policy}</FieldLabel>
								<NativeSelect
									onChange={(event) => selectPolicy(event.currentTarget.value)}
									value={selectedPolicy.key}
								>
									{enabledPolicies.map((policy) => (
										<NativeSelectOption key={policy.id} value={policy.key}>
											{policy.key} ·{" "}
											{t.console.apiQuotas.classes[policy.class]}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Field>
							{selectedPolicy.class === "privileged" ? (
								<Field required>
									<FieldLabel>
										{t.console.users.accountQuota.validUntil}
									</FieldLabel>
									<Input
										min={new Date().toISOString().slice(0, 16)}
										onChange={(event) =>
											setValidUntil(event.currentTarget.value)
										}
										required
										type="datetime-local"
										value={validUntil}
									/>
								</Field>
							) : null}
						</div>
						<Field className="w-auto" orientation="horizontal">
							<Checkbox
								checked={customize}
								onCheckedChange={({ checked }) => setCustomize(checked === true)}
							/>
							<div>
								<FieldLabel className="font-normal">
									{t.console.users.accountQuota.customize}
								</FieldLabel>
								<FieldDescription>
									{t.console.users.accountQuota.customizeDescription}
								</FieldDescription>
							</div>
						</Field>
						{customize ? (
							<>
								<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
									{(
										[
											[
												"requestsPerMinute",
												t.console.apiQuotas.requestsPerMinute,
											],
											["burstCapacity", t.console.apiQuotas.burstCapacity],
											[
												"maxConcurrentRequests",
												t.console.apiQuotas.maxConcurrentRequests,
											],
											["dailyCostUnits", t.console.apiQuotas.dailyCostUnits],
											[
												"maxActiveTokens",
												t.console.apiQuotas.maxActiveTokens,
											],
										] as const
									).map(([name, label]) => (
										<Field key={name} required>
											<FieldLabel>{label}</FieldLabel>
											<Input
												max={ranges[name].maximum}
												min={ranges[name].minimum}
												onChange={(event) =>
													setLimits((current) => ({
														...current,
														[name]: event.currentTarget.value,
													}))
												}
												required
												type="number"
												value={limits[name]}
											/>
										</Field>
									))}
								</div>
								<Field invalid={operations === undefined}>
									<FieldLabel>
										{t.console.apiQuotas.operationOverrides}
									</FieldLabel>
									<Textarea
										className="min-h-48 font-mono text-xs"
										onChange={(event) =>
											setOperationsText(event.currentTarget.value)
										}
										spellCheck={false}
										value={operationsText}
									/>
									<FieldDescription>
										{operations === undefined
											? t.console.apiQuotas.invalidOperations
											: t.console.apiQuotas.operationOverridesDescription}
									</FieldDescription>
								</Field>
							</>
						) : null}
						<Field required>
							<FieldLabel>{t.console.users.accountQuota.reason}</FieldLabel>
							<Textarea
								maxLength={1_000}
								onChange={(event) => setReason(event.currentTarget.value)}
								placeholder={t.console.users.accountQuota.reasonPlaceholder}
								required
								value={reason}
							/>
						</Field>
						{invalid ? (
							<p className="text-destructive text-sm">
								{t.console.users.accountQuota.invalid}
							</p>
						) : null}
						<RequestFailure
							error={assign.error ?? reset.error}
							fallback={t.console.users.accountQuota.updateFailed}
						/>
						<div className="flex flex-wrap justify-end gap-2">
							{quota.bindingRevision !== null ? (
								<Button
									disabled={assign.isPending}
									isLoading={reset.isPending}
									onClick={() => void resetAssignment()}
									type="button"
									variant="outline"
								>
									{t.console.users.accountQuota.reset}
								</Button>
							) : null}
							<Button
								disabled={reset.isPending || !reason.trim()}
								isLoading={assign.isPending}
								type="submit"
								variant="solid"
							>
								{t.console.users.accountQuota.save}
							</Button>
						</div>
					</form>
				) : (
					<p className="text-muted-foreground text-sm">
						{t.console.users.accountQuota.readOnly}
					</p>
				)}
			</CardContent>
		</Card>
	);
}

function QuotaValue({ label, value }: { readonly label: string; readonly value: string | number }) {
	return (
		<div>
			<p className="text-muted-foreground">{label}</p>
			<p className="mt-1 font-medium tabular-nums">{Number(value).toLocaleString()}</p>
		</div>
	);
}
