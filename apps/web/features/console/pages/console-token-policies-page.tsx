"use client";

import {
	getApiApiTokenPoliciesQueryKey,
	useGetApiApiTokenPolicies,
	usePatchApiApiTokenPoliciesByPolicyKey,
	type GetApiApiTokenPoliciesStatus200,
	type PatchApiApiTokenPoliciesByPolicyKeyBody,
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
	FieldLabel,
	Input,
	QueryFailure,
	QueryPending,
	Textarea,
	cn,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useConsoleWorkspace } from "../components/console-workspace";

type Policy = GetApiApiTokenPoliciesStatus200["items"][number];
type Operations = PatchApiApiTokenPoliciesByPolicyKeyBody["configuration"]["operations"];
type OperationLimits = Operations[string];
const OperationIdPattern = /^[A-Za-z][A-Za-z0-9_-]*$/;
const LimitKeys = ["requestsPerMinute", "maxConcurrentRequests", "dailyCostUnits"] as const;
type LimitKey = (typeof LimitKeys)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLimitKey(value: string): value is LimitKey {
	return LimitKeys.some((key) => key === value);
}

function parseOperations(value: string): Operations | undefined {
	try {
		const parsed: unknown = JSON.parse(value);
		if (!isRecord(parsed)) return undefined;
		const result: Operations = {};
		for (const [operationId, rawLimits] of Object.entries(parsed)) {
			if (!OperationIdPattern.test(operationId) || !isRecord(rawLimits)) return undefined;
			const limits: OperationLimits = {};
			for (const [key, rawValue] of Object.entries(rawLimits)) {
				if (
					!isLimitKey(key) ||
					typeof rawValue !== "number" ||
					!Number.isInteger(rawValue) ||
					rawValue < 1
				)
					return undefined;
				limits[key] = rawValue;
			}
			if (Object.keys(limits).length === 0) return undefined;
			result[operationId] = limits;
		}
		return result;
	} catch {
		return undefined;
	}
}

export function ConsoleTokenPoliciesPage() {
	const { t } = useTranslation(["console", "errors"]);
	const { canManageTokenPolicies } = useConsoleWorkspace();
	const policies = useGetApiApiTokenPolicies({
		query: { enabled: canManageTokenPolicies },
	});
	const [selectedKey, setSelectedKey] = useState("");

	if (!canManageTokenPolicies)
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
					{t.console.sections.tokenPolicies.label}
				</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					{t.console.sections.tokenPolicies.description}
				</p>
			</header>
			{selected ? (
				<div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
					<Card appearance="outlined">
						<CardHeader>
							<CardTitle>{t.console.tokenPolicies.policyList}</CardTitle>
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
											{t.console.tokenPolicies.revision({
												revision: Number(policy.revision),
											})}
										</span>
									</span>
									<Badge variant={policy.enabled ? "success" : "outline"}>
										{policy.enabled
											? t.console.tokenPolicies.enabled
											: t.console.tokenPolicies.disabled}
									</Badge>
								</button>
							))}
						</CardContent>
					</Card>
					<TokenPolicyEditor
						key={`${selected.key}:${selected.revision}`}
						policy={selected}
					/>
				</div>
			) : (
				<p className="rounded-lg border border-border p-6 text-center text-muted-foreground text-sm">
					{t.console.tokenPolicies.empty}
				</p>
			)}
		</section>
	);
}

function TokenPolicyEditor({ policy }: { readonly policy: Policy }) {
	const { t } = useTranslation(["console"]);
	const queryClient = useQueryClient();
	const [requestsPerMinute, setRequestsPerMinute] = useState(
		Number(policy.configuration.limits.requestsPerMinute),
	);
	const [maxConcurrentRequests, setMaxConcurrentRequests] = useState(
		Number(policy.configuration.limits.maxConcurrentRequests),
	);
	const [dailyCostUnits, setDailyCostUnits] = useState(
		Number(policy.configuration.limits.dailyCostUnits),
	);
	const [operationsText, setOperationsText] = useState(() =>
		JSON.stringify(policy.configuration.operations, null, 2),
	);
	const operations = parseOperations(operationsText);
	const mutation = usePatchApiApiTokenPoliciesByPolicyKey({
		mutation: {
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: getApiApiTokenPoliciesQueryKey(),
				});
			},
		},
	});
	useEffect(() => {
		setRequestsPerMinute(Number(policy.configuration.limits.requestsPerMinute));
		setMaxConcurrentRequests(Number(policy.configuration.limits.maxConcurrentRequests));
		setDailyCostUnits(Number(policy.configuration.limits.dailyCostUnits));
		setOperationsText(JSON.stringify(policy.configuration.operations, null, 2));
	}, [policy]);
	const limitsValid =
		Number.isInteger(requestsPerMinute) &&
		requestsPerMinute > 0 &&
		Number.isInteger(maxConcurrentRequests) &&
		maxConcurrentRequests > 0 &&
		Number.isInteger(dailyCostUnits) &&
		dailyCostUnits > 0;
	const submit = (event: FormEvent) => {
		event.preventDefault();
		if (!operations || !limitsValid) return;
		mutation.mutate({
			path: { policyKey: policy.key },
			body: {
				expectedRevision: policy.revision,
				configuration: {
					limits: {
						requestsPerMinute,
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
							{t.console.tokenPolicies.kind}:{" "}
							{t.console.tokenPolicies.kinds[policy.kind]}
						</CardDescription>
					</div>
					<Badge variant="secondary">
						{t.console.tokenPolicies.schemaVersion({
							version: Number(policy.schemaVersion),
						})}
					</Badge>
				</div>
			</CardHeader>
			<CardContent>
				<form className="grid gap-5" onSubmit={submit}>
					<div className="grid gap-4 sm:grid-cols-3">
						<Field>
							<FieldLabel>{t.console.tokenPolicies.requestsPerMinute}</FieldLabel>
							<Input
								min={1}
								onChange={(event) =>
									setRequestsPerMinute(event.currentTarget.valueAsNumber)
								}
								required
								type="number"
								value={requestsPerMinute}
							/>
						</Field>
						<Field>
							<FieldLabel>{t.console.tokenPolicies.maxConcurrentRequests}</FieldLabel>
							<Input
								min={1}
								onChange={(event) =>
									setMaxConcurrentRequests(event.currentTarget.valueAsNumber)
								}
								required
								type="number"
								value={maxConcurrentRequests}
							/>
						</Field>
						<Field>
							<FieldLabel>{t.console.tokenPolicies.dailyCostUnits}</FieldLabel>
							<Input
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
					<Field invalid={operations === undefined}>
						<FieldLabel>{t.console.tokenPolicies.operationOverrides}</FieldLabel>
						<Textarea
							className="min-h-64 font-mono text-xs"
							onChange={(event) => setOperationsText(event.currentTarget.value)}
							spellCheck={false}
							value={operationsText}
						/>
						{operations === undefined ? (
							<p className="text-destructive text-xs">
								{t.console.tokenPolicies.invalidOperations}
							</p>
						) : (
							<p className="text-muted-foreground text-xs">
								{t.console.tokenPolicies.operationOverridesDescription}
							</p>
						)}
					</Field>
					<RequestFailure
						error={mutation.error}
						fallback={t.console.tokenPolicies.updateFailed}
					/>
					<div className="flex justify-end">
						<Button
							disabled={!operations || !limitsValid}
							isLoading={mutation.isPending}
							type="submit"
							variant="solid"
						>
							{t.console.tokenPolicies.save}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
