export * from "./src/Author.ts";
export * from "./src/Book.ts";
export * from "./src/Chapter.ts";
export * from "./src/common.ts";
export * from "./src/Tag.ts";
export * from "./src/User.ts";

import type { Author } from "./src/Author.ts";
import type { Book } from "./src/Book.ts";
import type { Chapter } from "./src/Chapter.ts";
import type { Tag } from "./src/Tag.ts";
import type { User } from "./src/User.ts";

export type InputCreateUnion =
	| Tag.Input.Create
	| User.Input.Create
	| Author.Input.Create
	| Chapter.Input.Create
	| Book.Input.Create;

export type InputReadUnion =
	| Tag.Input.Read
	| User.Input.Read
	| Author.Input.Read
	| Chapter.Input.Read
	| Book.Input.Read;

export type InputUpdateUnion =
	| Tag.Input.Update
	| User.Input.Update
	| Author.Input.Update
	| Chapter.Input.Update
	| Book.Input.Update;

export type InputDeleteUnion =
	| Tag.Input.Delete
	| User.Input.Delete
	| Author.Input.Delete
	| Chapter.Input.Delete
	| Book.Input.Delete;

export type InputUnion =
	| InputCreateUnion
	| InputReadUnion
	| InputUpdateUnion
	| InputDeleteUnion;
