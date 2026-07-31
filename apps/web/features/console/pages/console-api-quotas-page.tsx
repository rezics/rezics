"use client";

import {
	getApiApiQuotaPoliciesQueryKey,
	useGetApiApiQuotaPolicies,
	usePutApiApiQuotaPoliciesByPolicyKey,
	type GetApiApiQuotaPoliciesStatus200,
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
	QueryFailure,
	QueryPending,
	Textarea,
	cn,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useConsoleWorkspace } from "../components/console-workspace";

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
	return typeof value === "number" && Number.isInteger(value) && value > 0;
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
	const { t } = useTranslation(["console", "errors"]);
	const { canReadApiQuotaPolicies } = useConsoleWorkspace();
	const policies = useGetApiApiQuotaPolicies({
		query: { enabled: canReadApiQuotaPolicies },
	});
	const [selectedKey, setSelectedKey] = useState("");

	if (!canReadApiQuotaPolicies)
		return <p className="text-destructive text-sm">{t.errors.forbidden}</p>;
	if (policies.isPending) return <QueryPending />;
	if (policies.isError || !policies.data)
		return <QueryFailure error={policies.error} retry={() => void policies.refetch()} />;
	const selected =
		policies.data.items.find((policy) => policy.key === selectedKey) ?? policies.data.items[0];

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
			{selected ? (
				<div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
					<Card appearance="outlined">
						<CardHeader>
							<CardTitle>{t.console.apiQuotas.policyList}</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-1">
							{policies.data.items.map((policy) => (
								<button
									className={cn(
										"flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start text-sm",
										policy.key === selected.key
											? "bg-primary/10 text-primary"
											: "hover:bg-accent",
									)}
									key={policy.id}
									onClick={() => setSelectedKey(policy.key)}
									type="button"
								>
									<span className="min-w-0">
										<span className="block truncate font-medium">
											{policy.key}
										</span>
										<span className="text-muted-foreground text-xs">
											{t.console.apiQuotas.revision({
												revision: Number(policy.revision),
											})}
										</span>
									</span>
									<Badge variant={policy.enabled ? "success" : "outline"}>
										{policy.enabled
											? t.console.apiQuotas.enabled
											: t.console.apiQuotas.disabled}
									</Badge>
								</button>
							))}
						</CardContent>
					</Card>
					<ApiQuotaPolicyEditor
						key={`${selected.key}:${selected.revision}`}
						policy={selected}
					/>
				</div>
			) : (
				<p className="rounded-lg border border-border p-6 text-center text-muted-foreground text-sm">
					{t.console.apiQuotas.empty}
				</p>
			)}
		</section>
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
	const [maxActiveTokens, setMaxActiveTokens] = useState(
		Number(policy.configuration.maxActiveTokens),
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
		maxActiveTokens,
	].every((value) => Number.isInteger(value) && value > 0);
	const submit = (event: FormEvent) => {
		event.preventDefault();
		const trimmedReason = reason.trim();
		if (!operations || !limitsValid || !trimmedReason || !canUpdateApiQuotaPolicies) return;
		mutation.mutate({
			path: { policyKey: policy.key },
			body: {
				expectedRevision: policy.revision,
				reason: trimmedReason,
				configuration: {
					limits: {
						requestRate: { requestsPerMinute, burstCapacity },
						maxConcurrentRequests,
						dailyCostUnits,
					},
					maxActiveTokens,
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
							{t.console.apiQuotas.policyClass}:{" "}
							{t.console.apiQuotas.classes[policy.class]}
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
					<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
						<NumericQuotaField
							disabled={!canUpdateApiQuotaPolicies}
							label={t.console.apiQuotas.maxActiveTokens}
							onChange={setMaxActiveTokens}
							value={maxActiveTokens}
						/>
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
					<RequestFailure
						error={mutation.error}
						fallback={t.console.apiQuotas.updateFailed}
					/>
					{canUpdateApiQuotaPolicies ? (
						<div className="flex justify-end">
							<Button
								disabled={!operations || !limitsValid || !reason.trim()}
								isLoading={mutation.isPending}
								type="submit"
								variant="solid"
							>
								{t.console.apiQuotas.save}
							</Button>
						</div>
					) : (
						<p className="text-muted-foreground text-sm">
							{t.console.apiQuotas.readOnly}
						</p>
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
				min={1}
				onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
				required
				type="number"
				value={value}
			/>
		</Field>
	);
}
