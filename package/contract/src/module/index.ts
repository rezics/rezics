import useSWR from "swr";

import { TagContract } from "./Tag";
import { createContract, Term } from "@selext/core";

export type Contract = TagContract;

export const contract: Contract = createContract({}) as any;

type InferOverloadReturnType<TFunc, TArgs extends any[]> = TFunc extends (
    ...args: TArgs
) => infer TReturn ? TReturn
    : never;

export const query = <TTerm extends Term<any, any, any, any>>(
    contract: TTerm,
) => (async (input) => {
    const swr = useSWR(input, contract);
}) as Awaited<TTerm>;

const res = await query(contract)({
    operation: "tag.delete",
    parameter: { id: "123" },
    select: { id: true, name: true },
});

const _res = await contract({
    operation: "tag.delete",
    parameter: { id: "123" },
    select: { id: true, name: true },
});
