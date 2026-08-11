import { compileSchema, defineSchema } from "@portabletext/schema";

/**
 * Editable Portable Text schema for REZICS Markdown v1.
 *
 * @alpha
 */
export const rezicsMarkdownSchemaDefinition = defineSchema({
	block: { fields: [{ name: "checked", type: "boolean" }] },
	styles: [
		{ name: "normal" },
		{ name: "h1" },
		{ name: "h2" },
		{ name: "h3" },
		{ name: "h4" },
		{ name: "h5" },
		{ name: "h6" },
		{ name: "blockquote" },
	],
	decorators: [{ name: "strong" }, { name: "em" }, { name: "code" }, { name: "strike-through" }],
	annotations: [
		{
			name: "link",
			fields: [
				{ name: "href", type: "string" },
				{ name: "title", type: "string" },
			],
		},
	],
	lists: [{ name: "bullet" }, { name: "number" }, { name: "task" }],
	inlineObjects: [
		{
			name: "image",
			fields: [
				{ name: "src", type: "string" },
				{ name: "alt", type: "string" },
				{ name: "title", type: "string" },
			],
		},
	],
	blockObjects: [
		{
			name: "code",
			fields: [
				{ name: "language", type: "string" },
				{ name: "code", type: "string" },
			],
		},
		{ name: "horizontal-rule" },
		{ name: "html", fields: [{ name: "html", type: "string" }] },
		{
			name: "image",
			fields: [
				{ name: "src", type: "string" },
				{ name: "alt", type: "string" },
				{ name: "title", type: "string" },
			],
		},
		{
			name: "table",
			fields: [
				{ name: "headerRows", type: "number" },
				{ name: "alignment", type: "array" },
				{
					name: "rows",
					type: "array",
					of: [
						{
							type: "object",
							name: "row",
							fields: [
								{
									name: "cells",
									type: "array",
									of: [
										{
											type: "object",
											name: "cell",
											fields: [
												{
													name: "value",
													type: "array",
													of: [{ type: "block" }],
												},
											],
										},
									],
								},
							],
						},
					],
				},
			],
		},
	],
});

/**
 * Compiled converter schema for REZICS Markdown v1.
 *
 * @alpha
 */
export const rezicsMarkdownSchema = compileSchema(rezicsMarkdownSchemaDefinition);
