export interface PlatformUserCursor {
	readonly createdAt: string;
	readonly userId: string;
}

const UuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodePlatformUserCursor(cursor: PlatformUserCursor): string {
	return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodePlatformUserCursor(value: string): PlatformUserCursor | undefined {
	try {
		const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			"createdAt" in parsed &&
			typeof parsed.createdAt === "string" &&
			"userId" in parsed &&
			typeof parsed.userId === "string" &&
			Object.keys(parsed).length === 2 &&
			UuidPattern.test(parsed.userId) &&
			!Number.isNaN(new Date(parsed.createdAt).getTime())
		)
			return { createdAt: parsed.createdAt, userId: parsed.userId };
	} catch {
		return undefined;
	}
	return undefined;
}
