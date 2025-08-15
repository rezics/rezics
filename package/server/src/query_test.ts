import { assertEquals } from "@std/assert";
import { selectQuery } from "./query.ts";

Deno.test("query simple", () => {
	assertEquals(
		selectQuery<{
			id: string;
			name: string;
		}>({ id: true, name: true }),
		`{id,name}`,
	);
});

Deno.test("query nested", () => {
	assertEquals(
		selectQuery<{
			id: string;
			name: string;
			metadata: {
				createdAt: string;
				updatedAt: string;
			};
		}>({
			id: true,
			name: true,
			metadata: {
				createdAt: true,
				updatedAt: true,
			},
		}),
		`{id,name,metadata:{createdAt,updatedAt}}`,
	);
});
