export type AccountAction = "write" | "contribute";

// Rate limits and trust restrictions need feature-specific policy inputs. They
// remain visible without becoming broad, accidental denials here.
export function doesEnforcementBlockAction(kind: string, action: AccountAction) {
	return (
		kind.toLowerCase() === "ban" ||
		kind.toLowerCase() === "suspension" ||
		(kind.toLowerCase() === "silence" && action === "contribute")
	);
}
