export interface AuditCursor {
	readonly createdAt: string;
	readonly id: string;
}

const UuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeAuditCursor(cursor: AuditCursor): string {
	return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeAuditCursor(value: string): AuditCursor | undefined {
	try {
		const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			"createdAt" in parsed &&
			typeof parsed.createdAt === "string" &&
			"id" in parsed &&
			typeof parsed.id === "string" &&
			Object.keys(parsed).length === 2 &&
			UuidPattern.test(parsed.id) &&
			!Number.isNaN(new Date(parsed.createdAt).getTime())
		)
			return { createdAt: parsed.createdAt, id: parsed.id };
	} catch {
		return undefined;
	}
	return undefined;
}
