export type ArraySelect<TBaseItem> = [
    {
        select: Select<TBaseItem>;
        offset: number;
        length: number;
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
> = Result<TBaseItem, TSelect[0]["select"]>[];

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

/*

{
    type Book = {
        title: string;
        author: Author[];
    };

    type Author = {
        name: string;
        age: number;
    };

    const select = {
        title: true,
        author: [
            {
                select: {
                    name: true,
                },
                offset: 0,
                length: 100,
            },
        ],
    } satisfies Select<Book>;

    const result: Result<Book, typeof select> = {
        title: "Hello, World!",
        author: [
            {
                name: "Nice",
            },
        ],
    };
}

*/
