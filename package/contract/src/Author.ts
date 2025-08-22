import type { Interface } from "database";
import type { Input, Output, Result, Select } from "./common.ts";

export namespace Author {
	export namespace Input {
		export type Create = Input<
			Interface.Author,
			"author.create",
			Result<Interface.Author, { name: true }>
		>;

		export type Read = Input<
			Interface.Author,
			"author.read",
			Result<Interface.Author, { id: true }>
		>;

		export type Update = Input<
			Interface.Author,
			"author.update",
			& Result<Interface.Author, { id: true }>
			& Partial<Omit<Interface.Author, "id">>
		>;

		export type Delete = Input<
			Interface.Author,
			"author.delete",
			Result<Interface.Author, { id: true }>
		>;
	}

	export namespace Output {
		export type Create<TSelect extends Select<Interface.Author>> = Output<
			Interface.Author,
			TSelect
		>;

		export type Read<TSelect extends Select<Interface.Author>> = Output<
			Interface.Author,
			TSelect
		>;

		export type Update<TSelect extends Select<Interface.Author>> = Output<
			Interface.Author,
			TSelect
		>;

		export type Delete<TSelect extends Select<Interface.Author>> = Output<
			Interface.Author,
			TSelect
		>;
	}
}
