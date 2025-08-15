/**
 * Array selection descriptor for arrays.
 * Tuple of [item selection, pagination options].
 * - select: selection applied to each item
 * - option.offset: 0-based start index
 * - option.length: number of items to include (optional)
 * @template TBaseItem Item type of the source array
 */
export type ArraySelect<TBaseItem> = [
	select: Select<TBaseItem>,
	option?: {
		/** 0-based start index */
		offset: number;
		/** Number of items to include (to end if omitted) */
		length?: number;
	},
];

/** Select all fields at current depth (shallow) */
export type SelectAll = "*";

/** Select all fields recursively (deep) */
export type SelectDeepAll = "**";

/**
 * Flexible selection type depending on the base type:
 * - Array → ArraySelect of its item type
 * - Object → partial map of keys to nested Select, or wildcards "*" / "**"
 * - Scalar → true
 * @template TBase Base type to select from
 */
export type Select<TBase> = (TBase extends Date ? string : TBase) extends object
	// Is Object
	? TBase extends Array<infer TBaseItem>
		// Is Array
		? ArraySelect<TBaseItem>
		// Is Object, But Not Array
	:
		| Partial<{ [TKey in keyof TBase]: Select<TBase[TKey]> }>
		| SelectAll
		| SelectDeepAll
	// Is Scalar
	: true;

/**
 * Result type for array selections: an array of selected item results.
 * @template TBaseItem Item type of the source array
 * @template TSelect Array selection applied to items
 */
export type ArrayResult<
	TBaseItem,
	TSelect extends ArraySelect<TBaseItem>,
> = Result<TBaseItem, TSelect[0]>[];

/**
 * Transform TBase into the shape described by TSelect.
 * Rules:
 * - Array → ArrayResult of item Result using the item selection (tuple[0])
 * - Object + "*" → Shallow<TBase>
 * - Object + "**" → TBase (deep copy)
 * - Object + field map → object with only selected keys, each recursively transformed
 * - Scalar → TBase
 * @template TBase Base type to transform
 * @template TSelect Selection to apply
 */
export type Result<TBase, TSelect extends Select<TBase>> = TBase extends object
	// Is Object
	? TBase extends Array<infer TBaseItem>
		// Is Array -> ArrayResult
		? ArrayResult<
			TBaseItem,
			TSelect extends ArraySelect<TBaseItem> ? TSelect : never
		>
		// Is Object, But Not Array
	: TSelect extends SelectAll
		// Select All (Shallow)
		? Shallow<TBase>
	: TSelect extends SelectDeepAll
		// Select Deep All
		? TBase
	: {
		[
			K in keyof TSelect as K extends keyof TBase
				? TSelect[K] extends Select<TBase[K]> ? K
				: never
				: never
		]: K extends keyof TBase
			// K Is In TBase
			? TSelect[K] extends Select<TBase[K]>
				// TSelect[K] Is Select
				? Result<TBase[K], TSelect[K]>
			: never
			: never;
	}
	// Is Scalar
	: TBase;

/**
 * Typed operation request envelope.
 * { operation, parameter, select }
 * @template TBase Result base type before selection
 * @template TOperation Operation identifier (string)
 * @template TParameter Operation parameters
 * @template TSelect Selection to apply to TBase
 * @template TFailureResponse Failure response type(s) (propagated to Output)
 */
export type Input<
	TBase,
	TOperation extends string,
	TParameter extends object,
	TSelect extends Select<TBase> = Select<TBase>,
> = { operation: TOperation; parameter: TParameter; select: TSelect };

/**
 * Typed operation response union.
 * Success returns the selected result shape; otherwise returns a failure payload.
 * @template TBase Result base type before selection
 * @template TSelect Selection to apply to TBase
 */
export type Output<
	TBase,
	TSelect extends Select<TBase> = Select<TBase>,
> = Result<TBase, TSelect>;

/**
 * Picks only non-object (shallow) properties of T.
 */
export type Shallow<T> = T extends object ? {
		[K in keyof T as T[K] extends object ? never : K]: T[K];
	}
	: T;

/**
 * Deep version of Partial. Recursively makes all properties optional.
 */
export type DeepPartial<T> = T extends object ? Partial<
		{
			[K in keyof T]: DeepPartial<T[K]>;
		}
	>
	: T;

/**
 * Discriminated response shape.
 * @template TType Discriminator literal
 * @template TResult Payload type
 */
export type Response<TType extends string, TResult> = {
	[K in TType]: TResult;
};

/** Successful response wrapper */
export type SuccessResponse<TResult> = Response<"success", TResult>;

/**
 * Enforces exact type match between T and U (no excess properties).
 * Resolves to T if exact, otherwise never.
 */
export type Exact<T, U> = T extends U ? (U extends T ? T : never) : never;

/** Convert a union type to an intersection type. */
export type UnionToIntersection<U> = (
	U extends any ? (k: U) => void : never
) extends (k: infer I) => void ? I
	: never;
