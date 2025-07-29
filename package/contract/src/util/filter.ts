export type BinaryOperator = "<" | ">";
export type Operator = BinaryOperator | `${BinaryOperator}=` | "==";

export type Filter<TBase> =
    TBase extends Array<infer TItem>
        ? [Filter<TItem>]
        : TBase extends Exclude<TBase extends object ? TBase : never, Date>
          ? { [K in keyof TBase]?: Filter<TBase[K]> }
          : [operator: Operator, reference: TBase];
