import type { Interface } from "database";
import type { Input, Output, Result, Select } from "./common.ts";

export namespace Tag {
	export namespace Input {
		export type Create = Input<
			Interface.Tag,
			"tag.create",
			Result<
				Interface.Tag,
				{ name: true; type: true; owners: [{ id: true }] }
			>
		>;

		export type Read = Input<
			Interface.Tag,
			"tag.read",
			Result<Interface.Tag, { id: true }>
		>;

		export type Update = Input<
			Interface.Tag,
			"tag.update",
			& Result<Interface.Tag, { id: true }>
			& Partial<Omit<Interface.Tag, "id">>
		>;

		export type Delete = Input<
			Interface.Tag,
			"tag.delete",
			Result<Interface.Tag, { id: true }>
		>;
	}

	export namespace Output {
		export type Create<TSelect extends Select<Interface.Tag>> = Output<
			Interface.Tag,
			TSelect
		>;

		export type Read<TSelect extends Select<Interface.Tag>> = Output<
			Interface.Tag,
			TSelect
		>;

		export type Update<TSelect extends Select<Interface.Tag>> = Output<
			Interface.Tag,
			TSelect
		>;

		export type Delete<TSelect extends Select<Interface.Tag>> = Output<
			Interface.Tag,
			TSelect
		>;
	}
}
