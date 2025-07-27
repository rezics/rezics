import z, { ZodObject, ZodType } from "zod";
import { objectMap } from "./objectMap";

type Select<T> = T extends object
    ? Partial<{ [K in keyof T]: Select<T[K]> }>
    : boolean;
export const Select = <TSchema extends ZodType>(
    schema: TSchema,
): ZodType<Select<z.infer<TSchema>>> => {
    if (schema instanceof ZodObject) {
        return z.object(
            objectMap(schema.partial().shape, (value) => Select(value)),
        ) as any;
    } else {
        return z.boolean() as any;
    }
};

type Result<T, S extends Select<T>> = T extends object
    ? {
          [K in keyof S]: K extends keyof T
              ? Result<T[K], S[K] extends Select<T[K]> ? S[K] : never>
              : never;
      }
    : T;
export const Result = <
    TSchema extends ZodType,
    TSelect extends Select<z.infer<TSchema>>,
>(
    schema: TSchema,
    select: ZodType<TSelect>,
): ZodType<Result<z.infer<TSchema>, TSelect>> => {
    if (select instanceof ZodObject && schema instanceof ZodObject) {
        return z.object(
            objectMap(select.shape, (value, key) =>
                Result(schema.shape[key], value),
            ),
        ) as any;
    } else {
        return schema as any;
    }
};
