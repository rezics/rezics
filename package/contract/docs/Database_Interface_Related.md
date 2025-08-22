- [1. What is an Interface?](#1-what-is-an-interface)
- [2. Auto-Generating Interfaces (from PostgreSQL Schema)](#2-auto-generating-interfaces-from-postgresql-schema)
  - [a) Using **Prisma**](#a-using-prisma)
  - [b) Using **pgtyped**](#b-using-pgtyped)
  - [c) Using **schemats** or **pg-to-ts**](#c-using-schemats-or-pg-to-ts)
- [3. Recommendations](#3-recommendations)

# 1. What is an Interface?

In the type system, `Interface.Book` represents the **complete structure of a
database table (or domain model)**.

For example, given a `books` table:

```sql
CREATE TABLE books (
	id UUID PRIMARY KEY,
	name TEXT NOT NULL,
	description TEXT,
	published_at TIMESTAMP,
	author_ids UUID [] -- stores an array of author IDs
);
```

The corresponding TypeScript interface would look like this:

```ts
export interface Book {
	id: string; // uuid → string
	name: string; // text → string
	description: string | null;
	published_at: Date | null; // timestamp → Date
	author_ids: string[]; // uuid[] → string[]
}
```

With this definition, systems such as `Select<Book>` or `Result<Book, …>` can
project or transform the model correctly.

---

# 2. Auto-Generating Interfaces (from PostgreSQL Schema)

Instead of writing interfaces by hand, there are several approaches for
generating them automatically.

### a) Using **Prisma**

Prisma generates TypeScript types directly from a PostgreSQL schema.

```prisma
model Book {
  id          String   @id @default(uuid())
  name        String
  description String?
  publishedAt DateTime?
  authors     Author[] @relation("BookAuthors")
}
```

Then run:

```bash
npx prisma generate
```

Prisma produces a `Book` type under `@prisma/client`, which can be used directly
as `Interface.Book`.

---

### b) Using **pgtyped**

[pgtyped](https://pgtyped.dev) generates TypeScript types from raw SQL queries.
For example:

```sql
/* @name GetBookById */
SELECT
	id,
	name,
	description,
	published_at
FROM
	books
WHERE
	id = :id;
```

pgtyped will generate a `.ts` file with the inferred type:

```ts
export interface GetBookByIdRow {
	id: string;
	name: string;
	description: string | null;
	published_at: Date | null;
}
```

---

### c) Using **schemats** or **pg-to-ts**

These tools scan the PostgreSQL schema and output TypeScript interfaces.

```bash
npx schemats generate \
  -c "postgres://user:pass@localhost:5432/db" \
  -o schema.ts
```

The generated file might look like:

```ts
export interface books {
	id: string;
	name: string;
	description: string | null;
	published_at: Date | null;
	author_ids: string[];
}
```

---

# 3. Recommendations

- If you need **both ORM and types**: use **Prisma**. It provides schema
  migrations, relationships, and generated types.
- If you only need **type definitions**: tools like `pg-to-ts` or `schemats` are
  sufficient.
- If you plan to integrate with a custom **selector/projector system**: ensure
  `Interface.Book` mirrors the database schema accurately, then apply
  `Result<Book, Select>` for projection.

---

Would you like me to also include a minimal Node.js script example that queries
`information_schema.columns` and generates TypeScript interfaces—so you can
avoid depending on an ORM altogether?
