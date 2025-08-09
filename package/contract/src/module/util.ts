import { FailureResponse, Term } from "@selext/core";

export type DateIsString<T> = T extends object ? {
        [TKey in keyof T]: DateIsString<T[TKey]>;
    }
    : T extends Date ? string
    : T;

export const objectMap = <T extends object, R>(
    obj: T,
    fn: <K extends keyof T>(value: T[K], key: K) => R,
): {
    [K in keyof T]: R;
} => {
    return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [
            key,
            fn(value, key as keyof T),
        ]),
    ) as any;
};

export type CRUDContract<
    TBase,
    TBaseOperation extends string,
    TCreateParameter extends object = object,
    TCreateFailureResponse extends FailureResponse<any> = never,
    TReadParameter extends object = object,
    TReadFailureResponse extends FailureResponse<any> = never,
    TUpdateParameter extends object = object,
    TUpdateFailureResponse extends FailureResponse<any> = never,
    TDeleteParameter extends object = object,
    TDeleteFailureResponse extends FailureResponse<any> = never,
> =
    & Term<
        TBase,
        `${TBaseOperation}.create`,
        TCreateParameter,
        TCreateFailureResponse
    >
    & Term<
        TBase,
        `${TBaseOperation}.read`,
        TReadParameter,
        TReadFailureResponse
    >
    & Term<
        TBase,
        `${TBaseOperation}.update`,
        TUpdateParameter,
        TUpdateFailureResponse
    >
    & Term<
        TBase,
        `${TBaseOperation}.delete`,
        TDeleteParameter,
        TDeleteFailureResponse
    >;
