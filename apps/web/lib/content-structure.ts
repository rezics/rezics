import {
	createPortableTextDocument,
	type PortableTextDocument,
	updatePortableTextDocument,
} from "@rezics/content-structure";
import { normalizePortableText, type PortableTextValue } from "@rezics/portable-text";

export function readPortableText(
	document: PortableTextDocument | null | undefined,
): PortableTextValue {
	return normalizePortableText(document?.content);
}

export function writePortableText(
	content: PortableTextValue,
	current?: PortableTextDocument | null,
): PortableTextDocument {
	const normalized = normalizePortableText(content);
	return current
		? updatePortableTextDocument(current, normalized)
		: createPortableTextDocument(normalized);
}
