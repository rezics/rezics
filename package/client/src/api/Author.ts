import { Author } from "contract";
import { postApi } from "./swr";

export async function createAuthor<
	TSelect extends Author.Input.Create["select"],
>(input: Author.Input.Create & { select: TSelect }): Promise<
	Author.Output.Create<TSelect>
> {
	return await postApi<typeof input, Author.Output.Create<TSelect>>(input);
}

export async function readAuthor<
	TSelect extends Author.Input.Read["select"],
>(input: Author.Input.Read & { select: TSelect }): Promise<
	Author.Output.Read<TSelect>
> {
	return await postApi<typeof input, Author.Output.Read<TSelect>>(input);
}

export async function updateAuthor<
	TSelect extends Author.Input.Update["select"],
>(input: Author.Input.Update & { select: TSelect }): Promise<
	Author.Output.Update<TSelect>
> {
	return await postApi<typeof input, Author.Output.Update<TSelect>>(input);
}

export async function deleteAuthor<
	TSelect extends Author.Input.Delete["select"],
>(input: Author.Input.Delete & { select: TSelect }): Promise<
	Author.Output.Delete<TSelect>
> {
	return await postApi<typeof input, Author.Output.Delete<TSelect>>(input);
}
