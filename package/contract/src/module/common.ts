export type ArraySelect<TBaseItem> = [
    select: Select<TBaseItem>,
    option?: {
        offset: number;
        length?: number;
        order?: "<" | ">";
        by?: keyof TBaseItem;
    },
];

export type Select<TBase> =
    TBase extends Exclude<TBase extends object ? TBase : never, Date>
        ? TBase extends Array<infer I>
            ? ArraySelect<I>
            : Partial<{ [K in keyof TBase]: Select<TBase[K]> }>
        : boolean;

export type ArrayResult<
    TBaseItem,
    TSelect extends ArraySelect<TBaseItem>,
> = Result<TBaseItem, TSelect[0]>[];

export type Result<TBase, TSelect extends Select<TBase>> = TSelect extends true
    ? TBase
    : TBase extends Array<infer TBaseItem>
      ? TSelect extends ArraySelect<TBaseItem>
          ? ArrayResult<TBaseItem, TSelect>
          : never
      : TSelect extends object
        ? {
              [K in keyof TSelect]: K extends keyof TBase
                  ? TSelect[K] extends Select<TBase[K]>
                      ? Result<TBase[K], TSelect[K]>
                      : never
                  : never;
          }
        : never;

export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type BinaryOperator = "<" | ">";
export type Operator = BinaryOperator | `${BinaryOperator}=` | "==";

export type Filter<TBase> =
    TBase extends Array<infer TItem>
        ? [Filter<TItem>]
        : TBase extends Exclude<TBase extends object ? TBase : never, Date>
          ? { [K in keyof TBase]?: Filter<TBase[K]> }
          : [operator: Operator, reference: TBase];

export type HTTPMethod = "GET" | "POST" | "DELETE" | "PATCH";

export type Shallow<T> = T extends object
    ? {
          [K in keyof T]: T[K] extends object ? never : T[K];
      }
    : T;

export type Response = {
    [Code: number]: any;
};

export type Input<TBase, TParameter extends object> = {
    method: HTTPMethod;
    params?: TParameter;
    select?: Select<TBase>;
    filter?: Filter<TBase>;
};

export type Output<TBase, TErrorResponse extends Response = {}> = {
    success: Result<TBase, Select<TBase>>;
    failure: TErrorResponse;
};

export type Contract<
    TPath extends string,
    TBase,
    TParameter extends object = {},
    TErrorResponse extends Response = {},
> = {
    path: TPath;
    in: Input<TBase, TParameter>;
    out: Output<TBase, TErrorResponse>;
};

export type CURD<
    TPath extends string,
    TBase,
    TCreateParameter extends object = {},
    TUpdateParameter extends object = {},
    TReadParameter extends object = {},
    TDeleteParameter extends object = {},
    TErrorResponse extends Response = {},
> = {
    create: Contract<
        `${TPath}/create`,
        TBase,
        TCreateParameter,
        TErrorResponse
    >;
    update: Contract<
        `${TPath}/update`,
        TBase,
        TUpdateParameter,
        TErrorResponse
    >;
    read: Contract<`${TPath}/read`, TBase, TReadParameter, TErrorResponse>;
    delete: Contract<
        `${TPath}/delete`,
        TBase,
        TDeleteParameter,
        TErrorResponse
    >;
};
