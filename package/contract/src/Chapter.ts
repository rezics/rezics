import type { Interface } from "database";
import type { Input, Output, Result, Select } from "./common.ts";

export namespace Chapter {
	export namespace Input {
		export type Create = Input<
			Interface.Chapter,
			"chapter.create",
			Result<Interface.Chapter, {
				name: true;
				book: { id: true };
			}>
		>;

		export type Read = Input<
			Interface.Chapter,
			"chapter.read",
			Result<Interface.Chapter, { id: true }>
		>;

		export type Update = Input<
			Interface.Chapter,
			"chapter.update",
			& Result<Interface.Chapter, { id: true }>
			& Partial<Omit<Interface.Chapter, "id">>
		>;

		export type Delete = Input<
			Interface.Chapter,
			"chapter.delete",
			Result<Interface.Chapter, { id: true }>
		>;
	}

	export namespace Output {
		export type Create<TSelect extends Select<Interface.Chapter>> = Output<
			Interface.Chapter,
			TSelect
		>;

		export type Read<TSelect extends Select<Interface.Chapter>> = Output<
			Interface.Chapter,
			TSelect
		>;

		export type Update<TSelect extends Select<Interface.Chapter>> = Output<
			Interface.Chapter,
			TSelect
		>;

		export type Delete<TSelect extends Select<Interface.Chapter>> = Output<
			Interface.Chapter,
			TSelect
		>;
	}
}
