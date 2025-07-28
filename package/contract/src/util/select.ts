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
