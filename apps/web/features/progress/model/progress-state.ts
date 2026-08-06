import {
	toTrackedUnitProgressState,
	type TrackedUnitProgressState,
	type UnitProgressRecord,
} from "./progress-record";

export type UnitProgressState =
	| { readonly kind: "signed-out" }
	| { readonly kind: "loading" }
	| { readonly kind: "error"; readonly error: unknown }
	| { readonly kind: "untracked" }
	| TrackedUnitProgressState;

export type EditableProgressState =
	| Extract<UnitProgressState, { readonly kind: "untracked" }>
	| TrackedUnitProgressState;

export function deriveUnitProgressState({
	authenticated,
	record,
	recordError,
	recordFailed,
	recordPending,
	sessionPending,
}: {
	readonly authenticated: boolean;
	readonly record: UnitProgressRecord | null;
	readonly recordError: unknown;
	readonly recordFailed: boolean;
	readonly recordPending: boolean;
	readonly sessionPending: boolean;
}): UnitProgressState {
	if (!authenticated && sessionPending) return { kind: "loading" };
	if (!authenticated) return { kind: "signed-out" };
	if (recordPending) return { kind: "loading" };
	if (recordFailed) return { kind: "error", error: recordError };
	return record ? toTrackedUnitProgressState(record) : { kind: "untracked" };
}

export function isEditableProgressState(state: UnitProgressState): state is EditableProgressState {
	switch (state.kind) {
		case "signed-out":
		case "loading":
		case "error":
			return false;
		case "untracked":
		case "backlog":
		case "active":
		case "paused":
		case "completed":
		case "dropped":
			return true;
	}
}

export function progressRecordFromEditableState(
	state: EditableProgressState,
): UnitProgressRecord | null {
	return state.kind === "untracked" ? null : state.record;
}
