import { Tag } from "contract";
import { postApi } from "./swr";

export async function createTag<
	TSelect extends Tag.Input.Create["select"],
>(input: Tag.Input.Create & { select: TSelect }): Promise<
	Tag.Output.Create<TSelect>
> {
	return await postApi<typeof input, Tag.Output.Create<TSelect>>(input);
}

export async function readTag<
	TSelect extends Tag.Input.Read["select"],
>(input: Tag.Input.Read & { select: TSelect }): Promise<
	Tag.Output.Read<TSelect>
> {
	return await postApi<typeof input, Tag.Output.Read<TSelect>>(input);
}

export async function updateTag<
	TSelect extends Tag.Input.Update["select"],
>(input: Tag.Input.Update & { select: TSelect }): Promise<
	Tag.Output.Update<TSelect>
> {
	return await postApi<typeof input, Tag.Output.Update<TSelect>>(input);
}

export async function deleteTag<
	TSelect extends Tag.Input.Delete["select"],
>(input: Tag.Input.Delete & { select: TSelect }): Promise<
	Tag.Output.Delete<TSelect>
> {
	return await postApi<typeof input, Tag.Output.Delete<TSelect>>(input);
}
