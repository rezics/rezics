import { Book } from "contract";
import { postApi } from "./swr";

export async function createBook<
	TSelect extends Book.Input.Create["select"],
>(input: Book.Input.Create & { select: TSelect }): Promise<
	Book.Output.Create<TSelect>
> {
	return await postApi<typeof input, Book.Output.Create<TSelect>>(input);
}

export async function readBook<
	TSelect extends Book.Input.Read["select"],
>(input: Book.Input.Read & { select: TSelect }): Promise<
	Book.Output.Read<TSelect>
> {
	return await postApi<typeof input, Book.Output.Read<TSelect>>(input);
}

export async function updateBook<
	TSelect extends Book.Input.Update["select"],
>(input: Book.Input.Update & { select: TSelect }): Promise<
	Book.Output.Update<TSelect>
> {
	return await postApi<typeof input, Book.Output.Update<TSelect>>(input);
}

export async function deleteBook<
	TSelect extends Book.Input.Delete["select"],
>(input: Book.Input.Delete & { select: TSelect }): Promise<
	Book.Output.Delete<TSelect>
> {
	return await postApi<typeof input, Book.Output.Delete<TSelect>>(input);
}
