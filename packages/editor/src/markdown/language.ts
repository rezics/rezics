import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import type { Extension } from "@codemirror/state";
import { rezicsMarkdownKeymap } from "./commands";

/**
 * CodeMirror language and command support for the frozen REZICS Markdown v1 source grammar.
 *
 * @alpha
 */
export function rezicsMarkdown(): Extension {
	return [markdown({ base: markdownLanguage }), rezicsMarkdownKeymap];
}
