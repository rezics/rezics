import type { SchemaDatabase } from "./postgres";
import { ConvertedContractSchema } from "../model";
import { digest, stableJson } from "@rezics/schema/identity";
import { convertProviderSchemas } from "../convert";
import {
	schemaContract,
	schemaContractField,
	schemaContractKeyword,
	schemaContractReference,
} from "@rezics/schema/postgres/vocabulary";

/** @alpha Install structured source contracts atomically; this never executes a source's SQL or business actions. */
export async function importConvertedContracts(db: SchemaDatabase, input: unknown[]) {
	const expected = new Map(
		(await convertProviderSchemas("all")).map((contract) => [contract.id, contract]),
	);
	if (input.length > expected.size)
		throw new TypeError("Contract selection exceeds the pinned inventory");
	const contracts = input.map((value) => ConvertedContractSchema.parse(value));
	if (new Set(contracts.map((contract) => contract.id)).size !== contracts.length)
		throw new TypeError("Duplicate source contract selection");
	for (const contract of contracts) {
		const compiled = expected.get(contract.id);
		if (!compiled || stableJson(contract) !== stableJson(compiled))
			throw new TypeError("Source contract differs from its pinned compilation");
	}
	const origins = new Map<string, string>();
	for (const contract of contracts) {
		origins.set(`${contract.source}:${contract.name}`, contract.id);
		origins.set(
			`${contract.origin}#/components/schemas/${encodeURIComponent(contract.name)}`,
			contract.id,
		);
	}
	await db.transaction(async (tx) => {
		for (const contract of contracts) {
			const { fields, ...header } = contract;
			await tx.insert(schemaContract).values(header).onConflictDoNothing();
			for (let offset = 0; offset < fields.length; offset += 200)
				await tx
					.insert(schemaContractField)
					.values(
						fields.slice(offset, offset + 200).map((field) => ({
							contractId: contract.id,
							id: field.id,
							path: field.path,
							pathHash: digest(field.path),
							shape: field.shape,
							required: field.required,
							cardinality: field.cardinality,
							nullability: field.nullability,
						})),
					)
					.onConflictDoNothing();
		}
		for (const contract of contracts)
			for (const field of contract.fields) {
				for (let offset = 0; offset < field.keywords.length; offset += 200)
					await tx
						.insert(schemaContractKeyword)
						.values(
							field.keywords.slice(offset, offset + 200).map((keyword, i) => ({
								contractId: contract.id,
								fieldId: field.id,
								position: offset + i,
								keyword: keyword.key,
								value: keyword.value,
							})),
						)
						.onConflictDoNothing();
				if (field.references.length)
					await tx
						.insert(schemaContractReference)
						.values(
							field.references.map((reference, position) => ({
								contractId: contract.id,
								fieldId: field.id,
								position,
								kind: reference.kind,
								reference: reference.value,
								targetContractId:
									origins.get(reference.target ?? "") ??
									origins.get(`${contract.source}:${reference.value.split(".")[0]}`) ??
									null,
								targetPath:
									reference.target?.split("#")[1] ??
									(reference.value.split(".").slice(1).join(".") || null),
							})),
						)
						.onConflictDoNothing();
			}
	});
	return {
		contracts: contracts.length,
		fields: contracts.reduce((sum, contract) => sum + contract.fields.length, 0),
	};
}
