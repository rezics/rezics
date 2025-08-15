import type { Interface } from "database";
import type { Input, Output, Result, Select } from "./common.ts";

export namespace User {
	export namespace Input {
		export type Create = Input<
			Interface.User,
			"user.create",
			Result<Interface.User, { name: true; email: true }>
		>;

		export type Read = Input<
			Interface.User,
			"user.read",
			Result<Interface.User, { id: true }>
		>;

		export type Update = Input<
			Interface.User,
			"user.update",
			& Result<Interface.User, { id: true }>
			& Partial<Omit<Interface.User, "id">>
		>;

		export type Delete = Input<
			Interface.User,
			"user.delete",
			Result<Interface.User, { id: true }>
		>;
	}

	export namespace Output {
		export type Create<TSelect extends Select<Interface.User>> = Output<
			Interface.User,
			TSelect
		>;

		export type Read<TSelect extends Select<Interface.User>> = Output<
			Interface.User,
			TSelect
		>;

		export type Update<TSelect extends Select<Interface.User>> = Output<
			Interface.User,
			TSelect
		>;

		export type Delete<TSelect extends Select<Interface.User>> = Output<
			Interface.User,
			TSelect
		>;
	}
}
