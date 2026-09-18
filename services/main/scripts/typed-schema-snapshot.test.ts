import { expect, it } from "vitest";
import { captureTypedDatabaseSchema } from "./typed-schema-snapshot";

it("rebuilds the typed migration snapshot with a stable content identity", async () => {
	const first = await captureTypedDatabaseSchema();
	const second = await captureTypedDatabaseSchema();
	expect(first).toEqual(second);
	expect(first.id).toMatch(
		/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
	);
}, 40_000);
