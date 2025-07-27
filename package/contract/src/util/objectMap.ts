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
