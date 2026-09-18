import { AsyncLocalStorage } from "node:async_hooks";
import type { DatabaseTransaction } from "../database";
import type { CatalogReference } from "@rezics/schema/contracts/native/catalog";

type Initialization = {tx:DatabaseTransaction;reference:CatalogReference;evidenceSourceRecordId:string};
const initialization=new AsyncLocalStorage<Initialization>();

/** @internal A newly discovered foreign identity receives evidence, not ownership by the containing document's adoption mapping. */
export function withCatalogReferenceInitialization<T>(scope:Initialization,work:()=>Promise<T>):Promise<T> {
	return initialization.run(scope,work);
}
export function isCatalogReferenceInitialization(tx:DatabaseTransaction,sourceRecordId:string,reference?:CatalogReference):boolean {
	const scope=initialization.getStore();
	return scope?.tx===tx && scope.evidenceSourceRecordId===sourceRecordId &&
		(reference===undefined || (scope.reference.owner===reference.owner && scope.reference.id===reference.id));
}
