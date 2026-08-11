/** @alpha */
export const editorModes = ["source", "rich"] as const;

/** @alpha */
export type EditorMode = (typeof editorModes)[number];

/** @alpha */
export function isEditorMode(value: unknown): value is EditorMode {
	return typeof value === "string" && editorModes.some((mode) => mode === value);
}
