## Schema

Defined in `src/schema.ts` using Zod, with a JSON Schema (Draft-7) exporter as
the default export of the module.

### Unit

```ts
type Unit = {
	title: string;
	children?: Unit[];
};
```

### Book

```ts
type Book = {
	id: { isbn?: string; icsid?: string };
	cover: base64; // bytes as base64 string
	title: string;
	authors: string[]; // non-empty names
	units: Unit[]; // hierarchical TOC
	platform: string; // adapter/platform name
	link: string; // canonical URL
	tags: string[];
	description: string;
	release: string | null; // ISO datetime
	completed: boolean;
	length: number; // site-specific normalization
	last_update: string; // ISO datetime
	rating: number | null; // 0..1
};
```

### JSON Schema export

The module’s default export is a function returning a JSON string of the Draft-7
JSON Schema for `Book`:

```ts
import schemaJson from "../src/schema.js";
console.log(schemaJson());
```
