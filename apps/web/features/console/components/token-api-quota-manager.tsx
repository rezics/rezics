"use client";

import {
	getApiApiQuotaPoliciesAccountsByUserIdTokensQueryKey,
	type GetApiApiQuotaPoliciesAccountsByUserIdTokensStatus200,
	type GetApiApiQuotaPoliciesStatus200,
	type PutApiApiQuotaPoliciesAccountsByUserIdTokensByTokenIdBody,
	useDeleteApiApiQuotaPoliciesAccountsByUserIdTokensByTokenId,
	useGetApiApiQuotaPolicies,
	useGetApiApiQuotaPoliciesAccountsByUserIdTokens,
	usePutApiApiQuotaPoliciesAccountsByUserIdTokensByTokenId,
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
import { getTokenQuotaLimitRanges } from "@/features/settings/model/token-quota-limits";
import { useConsoleWorkspace } from "./console-workspace";

type ManagedToken = GetApiApiQuotaPoliciesAccountsByUserIdTokensStatus200["items"][number];
type Policy = GetApiApiQuotaPoliciesStatus200["items"][number];
type TokenOverride = NonNullable<
	PutApiApiQuotaPoliciesAccountsByUserIdTokensByTokenIdBody["configurationOverride"]
>;
type Operations = NonNullable<TokenOverride["operations"]>;
type OperationLimits = NonNullable<Operations[keyof Operations]>;
type LimitValues = Record<
	"requestsPerMinute" | "burstCapacity" | "maxConcurrentRequests" | "dailyCostUnits",
	string
>;

const OperationIds = [
	"search.execute",
	"image.upload",
] as const satisfies readonly (keyof Operations)[];
const OperationLimitKeys = ["requestRate", "maxConcurrentRequests", "dailyCostUnits"] as const;

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
	policyClass: Policy["class"],
): OperationLimits | undefined {
	if (!isRecord(value) || Object.keys(value).length === 0) return undefined;
	if (Object.keys(value).some((key) => !OperationLimitKeys.some((allowed) => allowed === key)))
		return undefined;
	const ranges = getTokenQuotaLimitRanges(policyClass);
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
		const parsed = parseIntegerInRange(
			value.maxConcurrentRequests,
			ranges.maxConcurrentRequests,
		);
		if (parsed === undefined) return undefined;
		result.maxConcurrentRequests = parsed;
	}
	if (value.dailyCostUnits !== undefined) {
		const parsed = parseIntegerInRange(value.dailyCostUnits, ranges.dailyCostUnits);
		if (parsed === undefined) return undefined;
		result.dailyCostUnits = parsed;
	}
	return result;
}

function parseOperations(value: string, policyClass: Policy["class"]): Operations | undefined {
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

function initialLimits(token: ManagedToken): LimitValues {
	const override = token.quota.configurationOverride.limits;
	return {
		requestsPerMinute: String(
			override?.requestRate?.requestsPerMinute ??
				token.quota.limits.requestRate.requestsPerMinute,
		),
		burstCapacity: String(
			override?.requestRate?.burstCapacity ?? token.quota.limits.requestRate.burstCapacity,
		),
		maxConcurrentRequests: String(
			override?.maxConcurrentRequests ?? token.quota.limits.maxConcurrentRequests,
		),
		dailyCostUnits: String(override?.dailyCostUnits ?? token.quota.limits.dailyCostUnits),
	};
}

function localDateTime(value: string | null): string {
	if (!value) return "";
	const date = new Date(value);
	const offset = date.getTimezoneOffset() * 60_000;
	return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function hasOverride(token: ManagedToken): boolean {
	return Object.keys(token.quota.configurationOverride).length > 0;
}

export function TokenApiQuotaManager({ userId }: { readonly userId: string }) {
	const { t } = useTranslation(["console", "settings"]);
	const { canReadTokenApiQuotas, canUpdateTokenApiQuotas } = useConsoleWorkspace();
	const tokens = useGetApiApiQuotaPoliciesAccountsByUserIdTokens(
		{ path: { userId } },
		{ query: { enabled: canReadTokenApiQuotas } },
	);
	const policies = useGetApiApiQuotaPolicies({
		query: { enabled: canUpdateTokenApiQuotas },
	});

	if (!canReadTokenApiQuotas) return null;
	if (tokens.isPending || (canUpdateTokenApiQuotas && policies.isPending))
		return <QueryPending />;
	if (tokens.isError || !tokens.data)
		return <QueryFailure error={tokens.error} retry={() => void tokens.refetch()} />;
	if (canUpdateTokenApiQuotas && (policies.isError || !policies.data))
		return <QueryFailure error={policies.error} retry={() => void policies.refetch()} />;

	const tokenPolicies = (policies.data?.items ?? []).filter(
		(policy) => policy.subjectKind === "token" && policy.enabled,
	);
	return (
		<section className="grid gap-4">
			<header>
				<h3 className="font-semibold">{t.settings.tokens.listTitle}</h3>
				<p className="mt-1 text-muted-foreground text-sm">
					{t.settings.tokens.listDescription}
				</p>
			</header>
			{tokens.data.items.length === 0 ? (
				<p className="rounded-lg border border-border p-6 text-center text-muted-foreground text-sm">
					{t.settings.tokens.empty}
				</p>
			) : (
				tokens.data.items.map((token) => (
					<TokenQuotaCard
						key={`${token.id}:${token.quota.policyRevision}:${token.quota.bindingRevision ?? 0}`}
						policies={tokenPolicies}
						token={token}
						userId={userId}
					/>
				))
			)}
		</section>
	);
}

function TokenQuotaCard({
	policies,
	token,
	userId,
}: {
	readonly policies: readonly Policy[];
	readonly token: ManagedToken;
	readonly userId: string;
}) {
	const { locale, t } = useTranslation(["console", "settings"]);
	const { canUpdateTokenApiQuotas } = useConsoleWorkspace();
	const queryClient = useQueryClient();
	const [policyKey, setPolicyKey] = useState(token.quota.key);
	const selectedPolicy = policies.find((policy) => policy.key === policyKey) ?? policies[0];
	const selectedClass = selectedPolicy?.class ?? token.quota.class;
	const [customize, setCustomize] = useState(hasOverride(token));
	const [limits, setLimits] = useState<LimitValues>(() => initialLimits(token));
	const [operationsText, setOperationsText] = useState(() =>
		JSON.stringify(token.quota.configurationOverride.operations ?? {}, null, 2),
	);
	const [validUntil, setValidUntil] = useState(() => localDateTime(token.quota.validUntil));
	const [reason, setReason] = useState("");
	const [invalid, setInvalid] = useState(false);
	const operations = parseOperations(operationsText, selectedClass);
	const queryKey = getApiApiQuotaPoliciesAccountsByUserIdTokensQueryKey({
		path: { userId },
	});
	const refresh = async () => queryClient.invalidateQueries({ queryKey });
	const assign = usePutApiApiQuotaPoliciesAccountsByUserIdTokensByTokenId<unknown>({
		mutation: { onSuccess: refresh },
	});
	const reset = useDeleteApiApiQuotaPoliciesAccountsByUserIdTokensByTokenId<unknown>({
		mutation: { onSuccess: refresh },
	});

	function selectPolicy(nextKey: string) {
		setPolicyKey(nextKey);
		const next = policies.find((policy) => policy.key === nextKey);
		if (!next) return;
		setLimits({
			requestsPerMinute: String(next.configuration.limits.requestRate.requestsPerMinute),
			burstCapacity: String(next.configuration.limits.requestRate.burstCapacity),
			maxConcurrentRequests: String(next.configuration.limits.maxConcurrentRequests),
			dailyCostUnits: String(next.configuration.limits.dailyCostUnits),
		});
		setOperationsText("{}");
		setInvalid(false);
		if (next.class === "standard") setValidUntil("");
	}

	function configurationOverride(): TokenOverride | undefined {
		if (!customize) return {};
		const ranges = getTokenQuotaLimitRanges(selectedClass);
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
		if (
			requestsPerMinute === undefined ||
			burstCapacity === undefined ||
			maxConcurrentRequests === undefined ||
			dailyCostUnits === undefined ||
			operations === undefined
		)
			return undefined;
		return {
			limits: {
				requestRate: { requestsPerMinute, burstCapacity },
				maxConcurrentRequests,
				dailyCostUnits,
			},
			operations,
		};
	}

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!selectedPolicy || !canUpdateTokenApiQuotas) return;
		const override = configurationOverride();
		const trimmedReason = reason.trim();
		const expiry = validUntil ? new Date(validUntil) : undefined;
		const expiryValid =
			selectedPolicy.class === "standard" ||
			(expiry !== undefined && Number.isFinite(expiry.getTime()) && expiry > new Date());
		const formInvalid = override === undefined || !trimmedReason || !expiryValid;
		setInvalid(formInvalid);
		if (formInvalid) return;
		await assign.mutateAsync({
			path: { userId, tokenId: token.id },
			body: {
				expectedRevision: Number(token.quota.bindingRevision ?? 0),
				policyKey: selectedPolicy.key,
				reason: trimmedReason,
				configurationOverride: override,
				...(selectedPolicy.class === "privileged" && expiry
					? { validUntil: expiry.toISOString() }
					: {}),
			},
		});
	}

	async function resetAssignment() {
		if (token.quota.bindingRevision === null || !canUpdateTokenApiQuotas) return;
		await reset.mutateAsync({
			path: { userId, tokenId: token.id },
			body: { expectedRevision: Number(token.quota.bindingRevision) },
		});
	}

	const ranges = getTokenQuotaLimitRanges(selectedClass);
	const formatter = new Intl.DateTimeFormat(locale.current, {
		dateStyle: "medium",
		timeStyle: "short",
	});
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
						<Badge variant="secondary">
							{t.console.apiQuotas.classes[token.quota.class]}
						</Badge>
						<Badge
							variant={
								token.quota.source === "privileged_fallback" ? "warning" : "outline"
							}
						>
							{t.console.users.accountQuota.sources[token.quota.source]}
						</Badge>
					</div>
				</div>
			</CardHeader>
			<CardContent className="grid gap-5">
				<div className="grid gap-3 rounded-lg bg-muted/35 p-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
					<QuotaValue
						label={t.console.apiQuotas.requestsPerMinute}
						value={token.quota.limits.requestRate.requestsPerMinute}
					/>
					<QuotaValue
						label={t.console.apiQuotas.burstCapacity}
						value={token.quota.limits.requestRate.burstCapacity}
					/>
					<QuotaValue
						label={t.console.apiQuotas.maxConcurrentRequests}
						value={token.quota.limits.maxConcurrentRequests}
					/>
					<QuotaValue
						label={t.console.apiQuotas.dailyCostUnits}
						value={token.quota.limits.dailyCostUnits}
					/>
				</div>
				{token.expiresAt ? (
					<p className="text-muted-foreground text-xs">
						{t.settings.tokens.expires}: {formatter.format(new Date(token.expiresAt))}
					</p>
				) : null}
				{canUpdateTokenApiQuotas && selectedPolicy ? (
					<form className="grid gap-5" onSubmit={submit}>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field required>
								<FieldLabel>{t.settings.tokens.policy}</FieldLabel>
								<NativeSelect
									onChange={(event) => selectPolicy(event.currentTarget.value)}
									value={selectedPolicy.key}
								>
									{policies.map((policy) => (
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
									{t.settings.tokens.configureLimits}
								</FieldLabel>
								<FieldDescription>
									{t.settings.tokens.limitsDescription}
								</FieldDescription>
							</div>
						</Field>
						{customize ? (
							<>
								<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
										className="min-h-40 font-mono text-xs"
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
							<p className="text-destructive text-sm" role="alert">
								{t.console.users.accountQuota.invalid}
							</p>
						) : null}
						<RequestFailure
							error={assign.error ?? reset.error}
							fallback={t.console.apiQuotas.updateFailed}
						/>
						<div className="flex flex-wrap justify-end gap-2">
							{token.quota.bindingRevision !== null ? (
								<Button
									isLoading={reset.isPending}
									onClick={() => void resetAssignment()}
									type="button"
									variant="outline"
								>
									{t.console.users.accountQuota.reset}
								</Button>
							) : null}
							<Button isLoading={assign.isPending} type="submit" variant="solid">
								{t.console.apiQuotas.save}
							</Button>
						</div>
					</form>
				) : null}
			</CardContent>
		</Card>
	);
}

function QuotaValue({ label, value }: { readonly label: string; readonly value: string | number }) {
	return (
		<div>
			<p className="text-muted-foreground">{label}</p>
			<p className="mt-1 font-semibold tabular-nums">{Number(value).toLocaleString()}</p>
		</div>
	);
}
