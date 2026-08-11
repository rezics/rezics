export interface OfficialRuleSeedOptions {
	readonly whenSeeded: "fail" | "skip";
}

export function parseOfficialRuleSeedOptions(args: readonly string[]): OfficialRuleSeedOptions {
	const uniqueArgs = new Set(args);
	if (uniqueArgs.size !== args.length)
		throw new Error("Official Rule Seed flags must not be repeated");
	if (!uniqueArgs.has("--yes"))
		throw new Error("Refusing to Seed the official Rule Realm without --yes");
	if ([...uniqueArgs].some((value) => value !== "--yes" && value !== "--if-needed"))
		throw new Error("Usage: seed-official-rule-realm.ts --yes [--if-needed]");
	return { whenSeeded: uniqueArgs.has("--if-needed") ? "skip" : "fail" };
}
