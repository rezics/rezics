export type ActiveTokenInventoryState = {
	readonly enabled: boolean;
	readonly expiresAt: Date | null;
};

export type ActiveTokenInventoryUpdate = {
	readonly enabled?: boolean;
	readonly expiresInDays?: number;
};

function isActive(state: ActiveTokenInventoryState, now: Date): boolean {
	return state.enabled && (state.expiresAt === null || state.expiresAt > now);
}

export function requiresActiveTokenReservation(
	current: ActiveTokenInventoryState,
	update: ActiveTokenInventoryUpdate,
	now: Date,
): boolean {
	const nextExpiresAt =
		update.expiresInDays === undefined
			? current.expiresAt
			: new Date(now.getTime() + update.expiresInDays * 24 * 60 * 60 * 1_000);
	return (
		!isActive(current, now) &&
		isActive({ enabled: update.enabled ?? current.enabled, expiresAt: nextExpiresAt }, now)
	);
}
