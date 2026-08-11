/** @alpha */
export type DiagnosticSeverity = "warning" | "error";

/** @alpha */
export type EditorDiagnosticLocation =
	| { readonly kind: "markdown"; readonly line?: number; readonly column?: number }
	| { readonly kind: "portable-text"; readonly path: readonly (string | number)[] }
	| { readonly kind: "document" };

/**
 * A machine-readable diagnostic. Product surfaces own localized messages for these codes.
 *
 * @alpha
 */
export interface EditorDiagnostic<TCode extends string = string> {
	readonly code: TCode;
	readonly severity: DiagnosticSeverity;
	readonly location: EditorDiagnosticLocation;
	readonly details?: Readonly<Record<string, string | number | boolean>>;
}

/** @alpha */
export type EditorSuccess<T, TDiagnostic extends EditorDiagnostic = EditorDiagnostic> = {
	readonly ok: true;
	readonly value: T;
	readonly diagnostics: readonly TDiagnostic[];
};

/** @alpha */
export type EditorFailure<TDiagnostic extends EditorDiagnostic = EditorDiagnostic> = {
	readonly ok: false;
	readonly diagnostics: readonly [TDiagnostic, ...TDiagnostic[]];
};

/** @alpha */
export type EditorResult<T, TDiagnostic extends EditorDiagnostic = EditorDiagnostic> =
	| EditorSuccess<T, TDiagnostic>
	| EditorFailure<TDiagnostic>;

/** @alpha */
export function editorSuccess<T, TDiagnostic extends EditorDiagnostic = EditorDiagnostic>(
	value: T,
	diagnostics: readonly TDiagnostic[] = [],
): EditorSuccess<T, TDiagnostic> {
	return { ok: true, value, diagnostics };
}

/** @alpha */
export function editorFailure<TDiagnostic extends EditorDiagnostic>(
	diagnostics: readonly [TDiagnostic, ...TDiagnostic[]],
): EditorFailure<TDiagnostic> {
	return { ok: false, diagnostics };
}
