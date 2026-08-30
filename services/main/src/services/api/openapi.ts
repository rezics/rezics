import { toOpenAPISchema } from "@elysia/openapi/openapi";
import {
	DockDocument,
	NavigationDocument,
	PortableTextDocument,
	UnitPresentationDocumentV0,
	UnitReferencedBlockDocument,
	ZoneAppearanceDocument,
} from "@rezics/block";
import { FilterDocument, FilterSchemaModels, SearchFeatureDefinition } from "@rezics/filter";
import { JsonValue } from "@rezics/portable-text";
import type { AnyElysia } from "elysia";
import { OpenAPIV3 } from "openapi-types";
import { Type } from "typebox";

import { ResolvedUnitPresentationResponse, UnitPresentationResponse } from "./custom-themes/schema";

const HttpMethods = [
	OpenAPIV3.HttpMethods.GET,
	OpenAPIV3.HttpMethods.POST,
	OpenAPIV3.HttpMethods.PUT,
	OpenAPIV3.HttpMethods.PATCH,
	OpenAPIV3.HttpMethods.DELETE,
	OpenAPIV3.HttpMethods.HEAD,
] as const;

const FilterDocumentComponent = Type.Object(
	{
		...FilterDocument.properties,
		where: Type.Optional(Type.Ref("UnitPredicate")),
	},
	{ additionalProperties: false, $id: "FilterDocument" },
);
const SearchFeatureDefinitionComponent = Type.Object(
	{
		...SearchFeatureDefinition.properties,
		filterDocument: Type.Ref("FilterDocument"),
	},
	{ additionalProperties: false, $id: "SearchFeatureDefinition" },
);

/** Stable public component boundaries retained from the Elysia 1 document. */
const RezicsOpenApiModels = {
	JsonValue: JsonValue.$defs.JsonValue,
	...FilterSchemaModels,
	DockDocument,
	NavigationDocument,
	PortableTextDocument,
	UnitReferencedBlockDocument,
	FilterDocument: FilterDocumentComponent,
	ZoneAppearanceDocument,
	ResolvedUnitPresentationResponse,
	UnitPresentationDocumentV0,
	UnitPresentationResponse,
	SearchFeatureDefinition: SearchFeatureDefinitionComponent,
} as const;

type JsonRecord = Record<string, unknown>;
const UnconstrainedSchemaMarker = "x-rezics-openapi-unconstrained";

function isJsonRecord(value: unknown): value is JsonRecord {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function componentName(value: unknown, componentNames: ReadonlySet<string>): string | undefined {
	if (!isJsonRecord(value) || typeof value.$id !== "string") return undefined;
	const name = value.$id.slice(value.$id.lastIndexOf("/") + 1);
	return componentNames.has(name) ? name : undefined;
}

function normalizeComponentReference(value: string, componentNames: ReadonlySet<string>): string {
	if (value.startsWith("#/")) return value;
	return componentNames.has(value) ? `#/components/schemas/${value}` : value;
}

function normalizeOpenApiValue(
	value: unknown,
	componentNames: ReadonlySet<string>,
	preserveComponent?: string,
	replaceComponents = true,
	seen = new WeakMap<object, unknown>(),
): unknown {
	if (Array.isArray(value)) {
		const cached = seen.get(value);
		if (cached) return cached;
		const normalized: unknown[] = [];
		seen.set(value, normalized);
		for (const item of value)
			normalized.push(
				normalizeOpenApiValue(item, componentNames, preserveComponent, replaceComponents, seen),
			);
		return normalized;
	}
	if (!isJsonRecord(value)) return value;
	if (value[UnconstrainedSchemaMarker] === true) return {};
	if (
		isJsonRecord(value.$defs) &&
		typeof value.$ref === "string" &&
		!value.$ref.startsWith("#/") &&
		value.$ref in value.$defs
	)
		return normalizeOpenApiValue(
			value.$defs[value.$ref],
			componentNames,
			preserveComponent,
			replaceComponents,
			seen,
		);

	const name = componentName(value, componentNames);
	if (replaceComponents && name && name !== preserveComponent)
		return { $ref: `#/components/schemas/${name}` };
	const cached = seen.get(value);
	if (cached) return cached;
	const normalized: JsonRecord = {};
	seen.set(value, normalized);
	for (const [key, child] of Object.entries(value)) {
		if (key.startsWith("~")) continue;
		if (key === "required" && Array.isArray(child) && child.length === 0) continue;
		if (key === "$ref" && typeof child === "string") {
			normalized.$ref = normalizeComponentReference(child, componentNames);
			continue;
		}
		if (key === "$defs" && isJsonRecord(child)) {
			const definitions: JsonRecord = {};
			for (const [definitionName, definition] of Object.entries(child)) {
				if (replaceComponents && componentNames.has(definitionName)) continue;
				definitions[definitionName] = normalizeOpenApiValue(
					definition,
					componentNames,
					preserveComponent,
					replaceComponents,
					seen,
				);
			}
			if (Object.keys(definitions).length > 0) normalized.$defs = definitions;
			continue;
		}
		const outputKey = key === "^.*$" ? "^(.*)$" : key;
		normalized[outputKey] = normalizeOpenApiValue(
			child,
			componentNames,
			preserveComponent,
			replaceComponents,
			seen,
		);
	}
	if (
		normalized.type === undefined &&
		Array.isArray(normalized.enum) &&
		normalized.enum.every((item) => typeof item === "string")
	)
		normalized.type = "string";
	if (
		normalized.type === "array" &&
		Array.isArray(normalized.items) &&
		normalized.items.length === 0 &&
		normalized.additionalItems === false
	) {
		delete normalized.items;
		delete normalized.additionalItems;
		normalized.maxItems = 0;
	}
	if (normalized.pattern === "^.*$") normalized.pattern = "^(.*)$";
	return normalized;
}

function openApiCompatibleSchema(schema: unknown): unknown {
	if (!isJsonRecord(schema)) return schema;
	const kind = Reflect.get(schema, "~kind");
	return kind === "Any" || kind === "Unknown"
		? { anyOf: [{}], [UnconstrainedSchemaMarker]: true }
		: schema;
}

function openApiCompatibleResponse(response: unknown): unknown {
	if (!isJsonRecord(response)) return response;
	if (Reflect.get(response, "~kind")) return openApiCompatibleSchema(response);
	return Object.fromEntries(
		Object.entries(response).map(([status, schema]) => [status, openApiCompatibleSchema(schema)]),
	);
}

function normalizeRezicsOpenApiDocument(document: ReturnType<typeof toOpenAPISchema>) {
	const componentNames = new Set(Object.keys(document.components.schemas));
	const schemas: JsonRecord = {};
	for (const [name, schema] of Object.entries(document.components.schemas))
		schemas[name] = normalizeOpenApiValue(schema, componentNames, name);
	return {
		...document,
		components: { ...document.components, schemas },
		paths: normalizeOpenApiValue(document.paths, componentNames) as OpenAPIV3.PathsObject,
	};
}

/**
 * Generate the JSON-only REZICS API contract around the Elysia 2 OpenAPI beta.
 *
 * The beta generator currently treats Elysia 2 parser hook entries as legacy
 * hook containers, so an explicit `parse: "json"` produces an empty content
 * map. A parser-free route view lets it retain the body schema; the result is
 * then narrowed to the only media type accepted by the versioned API.
 */
export function toRezicsOpenApiSchema(app: AnyElysia) {
	const routes = app.routes.map((route) => ({
		...route,
		hooks: route.hooks
			? {
					...route.hooks,
					parse: undefined,
					response: openApiCompatibleResponse(route.hooks.response),
				}
			: undefined,
	}));
	const routeView = new Proxy(app, {
		get(target, property, receiver) {
			if (property === "routes") return routes;
			if (property === "models")
				return { ...RezicsOpenApiModels, ...Reflect.get(target, property, receiver) };
			return Reflect.get(target, property, receiver);
		},
	});
	const document = normalizeRezicsOpenApiDocument(toOpenAPISchema(routeView));

	const paths: OpenAPIV3.PathsObject = document.paths;
	for (const path of Object.values(paths)) {
		if (!path) continue;
		for (const method of HttpMethods) {
			const operation = path[method];
			if (!operation?.requestBody || "$ref" in operation.requestBody) continue;
			const json = operation.requestBody.content["application/json"];
			if (!json) throw new Error(`OpenAPI request body for ${method} is missing its JSON schema`);
			operation.requestBody.content = { "application/json": json };
		}
	}

	return document;
}
