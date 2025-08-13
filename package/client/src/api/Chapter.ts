import { Chapter } from "contract";
import { postApi } from "./swr";

export async function createChapter<
    TSelect extends Chapter.Input.Create["select"],
>(input: Chapter.Input.Create & { select: TSelect }): Promise<
    Chapter.Output.Create<TSelect>
> {
    return await postApi<typeof input, Chapter.Output.Create<TSelect>>(input);
}

export async function readChapter<
    TSelect extends Chapter.Input.Read["select"],
>(input: Chapter.Input.Read & { select: TSelect }): Promise<
    Chapter.Output.Read<TSelect>
> {
    return await postApi<typeof input, Chapter.Output.Read<TSelect>>(input);
}

export async function updateChapter<
    TSelect extends Chapter.Input.Update["select"],
>(input: Chapter.Input.Update & { select: TSelect }): Promise<
    Chapter.Output.Update<TSelect>
> {
    return await postApi<typeof input, Chapter.Output.Update<TSelect>>(input);
}

export async function deleteChapter<
    TSelect extends Chapter.Input.Delete["select"],
>(input: Chapter.Input.Delete & { select: TSelect }): Promise<
    Chapter.Output.Delete<TSelect>
> {
    return await postApi<typeof input, Chapter.Output.Delete<TSelect>>(input);
}
