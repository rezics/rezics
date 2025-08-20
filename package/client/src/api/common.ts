export type OptionalOrUndef<T> = { [K in keyof T]?: T[K] | undefined };
