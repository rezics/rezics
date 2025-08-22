import type { Interface } from "database";
import type { Input, Output, Result, Select } from "./common.ts";

export namespace Book {
	export namespace Input {
		export type Create = Input<
			Interface.Book,
			"book.create",
			Result<Interface.Book, {
				name: true;
				authors: [{ id: true }];
			}>
		>;

		export type Read = Input<
			Interface.Book,
			"book.read",
			Result<Interface.Book, { id: true }>
		>;

		export type Update = Input<
			Interface.Book,
			"book.update",
			& Result<Interface.Book, { id: true }>
			& Partial<Omit<Interface.Book, "id">>
		>;

		export type Delete = Input<
			Interface.Book,
			"book.delete",
			Result<Interface.Book, { id: true }>
		>;
	}

	export namespace Output {
		export type Create<TSelect extends Select<Interface.Book>> = Output<
			Interface.Book,
			TSelect
		>;

		export type Read<TSelect extends Select<Interface.Book>> = Output<
			Interface.Book,
			TSelect
		>;

		export type Update<TSelect extends Select<Interface.Book>> = Output<
			Interface.Book,
			TSelect
		>;

		export type Delete<TSelect extends Select<Interface.Book>> = Output<
			Interface.Book,
			TSelect
		>;
	}
}
