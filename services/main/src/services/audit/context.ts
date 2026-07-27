import { AsyncLocalStorage } from "node:async_hooks";

export interface AuditRequestContext {
	readonly requestId: string;
	readonly credentialKind?: "session" | "api_token";
	readonly credentialId?: string;
}

const auditRequestContext = new AsyncLocalStorage<AuditRequestContext>();

export function enterAuditRequestContext(context: AuditRequestContext): void {
	auditRequestContext.enterWith(context);
}

export function runWithAuditRequestContext<Result>(
	context: AuditRequestContext,
	operation: () => Result,
): Result {
	return auditRequestContext.run(context, operation);
}

export function getAuditRequestContext(): AuditRequestContext | undefined {
	return auditRequestContext.getStore();
}

export function setAuditCredentialContext(
	credential: Pick<AuditRequestContext, "credentialKind" | "credentialId">,
): void {
	const current = auditRequestContext.getStore();
	if (current) auditRequestContext.enterWith({ ...current, ...credential });
}
